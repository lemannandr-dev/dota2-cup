#!/usr/bin/env python3
"""Pull official Dota Plus hero_xp from local .dem files and public Valve replays."""

from __future__ import annotations

import argparse
import bz2
import importlib.util
import json
import os
import sys
import tempfile
import time
import urllib.request
from typing import Any

try:
	import zstandard
except ImportError:
	zstandard = None

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HELPER = os.path.join(ROOT, "desktop-helper", "read-replay-plus.py")


def load_replay_plus():
	spec = importlib.util.spec_from_file_location("replay_plus", HELPER)
	if spec is None or spec.loader is None:
		raise RuntimeError(f"cannot load {HELPER}")
	module = importlib.util.module_from_spec(spec)
	spec.loader.exec_module(module)
	return module


def http_json(url: str) -> Any:
	time.sleep(0.2)
	req = urllib.request.Request(url, headers={"User-Agent": "AegisArena/1.0"})
	with urllib.request.urlopen(req, timeout=45) as response:
		return json.load(response)


def download(url: str, dest: str) -> None:
	req = urllib.request.Request(url, headers={"User-Agent": "AegisArena/1.0"})
	with urllib.request.urlopen(req, timeout=180) as response, open(dest, "wb") as out:
		while True:
			chunk = response.read(1024 * 256)
			if not chunk:
				break
			out.write(chunk)


def decompress_replay(compressed_path: str, demo_path: str) -> None:
	with open(compressed_path, "rb") as src:
		magic = src.read(8)
		src.seek(0)
		if magic.startswith(b"PBDEMS2"):
			with open(demo_path, "wb") as dst:
				while True:
					chunk = src.read(1024 * 256)
					if not chunk:
						break
					dst.write(chunk)
			return
		if magic.startswith(b"BZh"):
			with open(demo_path, "wb") as dst:
				dst.write(bz2.decompress(src.read()))
			return
		if magic.startswith(b"\x28\xb5\x2f\xfd"):
			if zstandard is None:
				raise RuntimeError("zstandard package is required to read current Valve replays")
			with open(demo_path, "wb") as dst:
				zstandard.ZstdDecompressor().copy_stream(src, dst)
			return
	raise RuntimeError(f"unknown replay compression {magic!r}")


def merge_hero(latest: dict[int, dict[str, Any]], row: dict[str, Any]) -> None:
	hero_id = int(row["heroId"])
	xp = int(row["xp"])
	current = latest.get(hero_id)
	if current and current["xp"] >= xp:
		return
	latest[hero_id] = row


def heroes_from_demo(module: Any, path: str, steam64: int | None) -> list[dict[str, Any]]:
	parsed = module.walk_demo(path)
	if not parsed.get("plusRows"):
		return []
	xp_values = [row["xp"] for row in parsed["plusRows"]]
	if not module.looks_like_plus_xp(xp_values):
		return []
	players = parsed.get("players") or []
	radiant = [player for player in players if player.get("team") == 2]
	dire = [player for player in players if player.get("team") == 3]
	if not radiant and len(players) >= 5:
		radiant = players[:5]
		dire = players[5:10]
	found: list[dict[str, Any]] = []
	for row in parsed["plusRows"]:
		side = radiant if row.get("teamNumber") == 0 else dire
		slot = row.get("teamSlot")
		player = side[slot] if isinstance(slot, int) and 0 <= slot < len(side) else None
		if steam64 and (not player or player.get("steamId") != steam64):
			continue
		hero_id = (player or {}).get("heroId") or row.get("heroId")
		if not hero_id:
			continue
		xp = int(row["xp"])
		found.append(
			{
				"heroId": int(hero_id),
				"level": module.level_from_xp(xp),
				"xp": xp,
				"matchId": parsed.get("matchId"),
				"fileName": parsed.get("fileName"),
				"source": "replay",
			}
		)
	return found


def collect_local(module: Any, dota_path: str, account_id: int) -> list[dict[str, Any]]:
	replay_dir = os.path.join(dota_path, "game", "dota", "replays")
	if not os.path.isdir(replay_dir):
		return []
	steam64 = account_id + 76561197960265728
	latest: dict[int, dict[str, Any]] = {}
	files = [
		entry
		for entry in os.scandir(replay_dir)
		if entry.is_file() and entry.name.lower().endswith(".dem") and entry.name.split(".")[0].isdigit()
	]
	files.sort(key=lambda item: item.stat().st_mtime, reverse=True)
	for entry in files:
		for row in heroes_from_demo(module, entry.path, steam64):
			merge_hero(latest, row)
	return list(latest.values())


def emit_progress(**payload: Any) -> None:
	sys.stderr.write("PLUS_PROGRESS " + json.dumps(payload, ensure_ascii=True) + "\n")
	sys.stderr.flush()


def load_hero_names() -> dict[int, str]:
	try:
		data = http_json("https://api.opendota.com/api/constants/heroes")
	except Exception:
		return {}
	rows = data.values() if isinstance(data, dict) else data if isinstance(data, list) else []
	names: dict[int, str] = {}
	for row in rows:
		if not isinstance(row, dict):
			continue
		hero_id = row.get("id")
		name = row.get("localized_name") or row.get("name")
		if isinstance(hero_id, int) and isinstance(name, str):
			names[hero_id] = name
	return names


def is_valve_unavailable(exc: Exception) -> bool:
	code = getattr(exc, "code", None)
	if code in {502, 503, 504}:
		return True
	text = str(exc)
	return "502" in text or "503" in text or "504" in text


def collect_public(
	module: Any, account_id: int, max_heroes: int, max_downloads: int
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
	meta: dict[str, Any] = {"matchesSeen": 0, "replaysTried": 0, "replaysParsed": 0, "skippedNoUrl": 0, "heroesTargeted": 0}
	emit_progress(stage="lookup", currentHeroId=None, currentHeroName=None, replaysTried=0, replaysParsed=0, heroesDone=[], heroesTargeted=0)
	played = http_json(f"https://api.opendota.com/api/players/{account_id}/heroes")
	recent = http_json(f"https://api.opendota.com/api/players/{account_id}/recentMatches")
	latest_by_hero: dict[int, dict[str, Any]] = {}
	if isinstance(played, list):
		for row in played:
			hero_id = row.get("hero_id")
			if isinstance(hero_id, int) and int(row.get("games") or 0) > 0:
				latest_by_hero[hero_id] = {"hero_id": hero_id, "match_id": None, "start_time": int(row.get("last_played") or 0)}
	if isinstance(recent, list):
		meta["matchesSeen"] = len(recent)
		for match in recent:
			hero_id = match.get("hero_id")
			match_id = match.get("match_id")
			if not isinstance(hero_id, int) or not isinstance(match_id, int):
				continue
			current = latest_by_hero.get(hero_id) or {}
			if not current.get("match_id"):
				latest_by_hero[hero_id] = match
	steam64 = account_id + 76561197960265728
	latest: dict[int, dict[str, Any]] = {}

	def replay_url_for(match_id: int) -> str | None:
		detail = http_json(f"https://api.opendota.com/api/matches/{match_id}")
		url = detail.get("replay_url") if isinstance(detail, dict) else None
		return str(url) if url else None

	def match_candidates(hero_id: int, first: dict[str, Any]) -> list[int]:
		ids: list[int] = []
		first_id = first.get("match_id")
		if isinstance(first_id, int):
			ids.append(first_id)
		try:
			extra = http_json(f"https://api.opendota.com/api/players/{account_id}/matches?hero_id={hero_id}&limit=12")
		except Exception:
			return ids[:12]
		if isinstance(extra, list):
			for row in extra:
				mid = row.get("match_id")
				if isinstance(mid, int) and mid not in ids:
					ids.append(mid)
		return ids[:12]

	ordered = sorted(latest_by_hero.items(), key=lambda item: -int(item[1].get("start_time") or 0))
	meta["heroesTargeted"] = min(len(ordered), max_heroes)
	names = load_hero_names()
	heroes_done: list[int] = []
	emit_progress(stage="lookup", currentHeroId=None, currentHeroName=None, replaysTried=0, replaysParsed=0, heroesDone=[], heroesTargeted=meta["heroesTargeted"])
	for hero_id, match in ordered[:max_heroes]:
		if meta["replaysTried"] >= max_downloads:
			meta["stoppedReason"] = "cdn_limit"
			break
		hero_name = names.get(hero_id)
		emit_progress(
			stage="download",
			currentHeroId=hero_id,
			currentHeroName=hero_name,
			replaysTried=meta["replaysTried"],
			replaysParsed=meta["replaysParsed"],
			heroesDone=heroes_done,
			heroesTargeted=meta["heroesTargeted"],
		)
		url = None
		used_match = None
		for match_id in match_candidates(hero_id, match):
			try:
				url = replay_url_for(match_id)
			except Exception:
				url = None
			if url:
				used_match = match_id
				break
			meta["skippedNoUrl"] += 1
		if not url or not used_match:
			continue
		meta["replaysTried"] += 1
		emit_progress(
			stage="download",
			currentHeroId=hero_id,
			currentHeroName=hero_name,
			matchId=used_match,
			lastEvent="downloading",
			replaysTried=meta["replaysTried"],
			replaysParsed=meta["replaysParsed"],
			heroesDone=heroes_done,
			heroesTargeted=meta["heroesTargeted"],
		)
		with tempfile.TemporaryDirectory(prefix="aegis-plus-") as tmp:
			compressed = os.path.join(tmp, f"{used_match}.dem.bz2")
			demo = os.path.join(tmp, f"{used_match}.dem")
			try:
				download(url, compressed)
				emit_progress(
					stage="parse",
					currentHeroId=hero_id,
					currentHeroName=hero_name,
					matchId=used_match,
					lastEvent="downloaded",
					replaysTried=meta["replaysTried"],
					replaysParsed=meta["replaysParsed"],
					heroesDone=heroes_done,
					heroesTargeted=meta["heroesTargeted"],
				)
				decompress_replay(compressed, demo)
				for row in heroes_from_demo(module, demo, steam64):
					row["source"] = "public_replay"
					row["matchId"] = used_match
					merge_hero(latest, row)
				if any(row["heroId"] == hero_id for row in latest.values()):
					meta["replaysParsed"] += 1
					heroes_done.append(hero_id)
			except Exception as exc:
				meta.setdefault("errors", []).append({"matchId": used_match, "error": str(exc)[:200]})
				if is_valve_unavailable(exc):
					meta.setdefault("valveUnavailable", 0)
					meta["valveUnavailable"] += 1
					continue
		emit_progress(
			stage="parse",
			currentHeroId=hero_id,
			currentHeroName=hero_name,
			matchId=used_match,
			lastEvent="parsed",
			replaysTried=meta["replaysTried"],
			replaysParsed=meta["replaysParsed"],
			heroesDone=heroes_done,
			heroesTargeted=meta["heroesTargeted"],
		)
	return list(latest.values()), meta


def main() -> int:
	parser = argparse.ArgumentParser()
	parser.add_argument("--account-id", type=int, required=True)
	parser.add_argument("--dota", default="")
	parser.add_argument("--max-heroes", type=int, default=25)
	parser.add_argument("--max-downloads", type=int, default=20)
	parser.add_argument("--out", default="")
	args = parser.parse_args()
	module = load_replay_plus()
	latest: dict[int, dict[str, Any]] = {}
	local = collect_local(module, args.dota, args.account_id) if args.dota else []
	for row in local:
		merge_hero(latest, row)
	public, public_meta = collect_public(module, args.account_id, args.max_heroes, max(0, args.max_downloads))
	for row in public:
		merge_hero(latest, row)
	result = {
		"accountId": args.account_id,
		"heroProgressPresent": len(latest) > 0,
		"heroes": sorted(latest.values(), key=lambda item: (-item["xp"], item["heroId"])),
		"localHeroCount": len(local),
		"public": public_meta,
	}
	text = json.dumps(result, ensure_ascii=True)
	if args.out:
		with open(args.out, "w", encoding="utf-8") as fh:
			fh.write(text)
	sys.stdout.write(text)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
