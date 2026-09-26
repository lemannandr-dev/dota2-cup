#!/usr/bin/env python3
"""Read Dota Plus hero_xp from local PBDEMS2 replays (CDOTAMatchMetadata)."""

from __future__ import annotations

import argparse
import json
import os
import re
import struct
import sys
from typing import Any

DEM_FILE_INFO = 2
DEM_CUSTOM_DATA = 10
DEM_IS_COMPRESSED = 64

HERO_NAME_TO_ID = {
	"npc_dota_hero_antimage": 1,
	"npc_dota_hero_axe": 2,
	"npc_dota_hero_bane": 3,
	"npc_dota_hero_bloodseeker": 4,
	"npc_dota_hero_crystal_maiden": 5,
	"npc_dota_hero_drow_ranger": 6,
	"npc_dota_hero_earthshaker": 7,
	"npc_dota_hero_juggernaut": 8,
	"npc_dota_hero_mirana": 9,
	"npc_dota_hero_nevermore": 11,
	"npc_dota_hero_morphling": 10,
	"npc_dota_hero_phantom_lancer": 12,
	"npc_dota_hero_puck": 13,
	"npc_dota_hero_pudge": 14,
	"npc_dota_hero_razor": 15,
	"npc_dota_hero_sand_king": 16,
	"npc_dota_hero_storm_spirit": 17,
	"npc_dota_hero_sven": 18,
	"npc_dota_hero_tiny": 19,
	"npc_dota_hero_vengefulspirit": 20,
	"npc_dota_hero_windrunner": 21,
	"npc_dota_hero_zuus": 22,
	"npc_dota_hero_kunkka": 23,
	"npc_dota_hero_lina": 25,
	"npc_dota_hero_lich": 31,
	"npc_dota_hero_lion": 26,
	"npc_dota_hero_shadow_shaman": 27,
	"npc_dota_hero_slardar": 28,
	"npc_dota_hero_tidehunter": 29,
	"npc_dota_hero_witch_doctor": 30,
	"npc_dota_hero_riki": 32,
	"npc_dota_hero_enigma": 33,
	"npc_dota_hero_tinker": 34,
	"npc_dota_hero_sniper": 35,
	"npc_dota_hero_necrolyte": 36,
	"npc_dota_hero_warlock": 37,
	"npc_dota_hero_beastmaster": 38,
	"npc_dota_hero_queenofpain": 39,
	"npc_dota_hero_venomancer": 40,
	"npc_dota_hero_faceless_void": 41,
	"npc_dota_hero_skeleton_king": 42,
	"npc_dota_hero_death_prophet": 43,
	"npc_dota_hero_phantom_assassin": 44,
	"npc_dota_hero_pugna": 45,
	"npc_dota_hero_templar_assassin": 46,
	"npc_dota_hero_viper": 47,
	"npc_dota_hero_luna": 48,
	"npc_dota_hero_dragon_knight": 49,
	"npc_dota_hero_dazzle": 50,
	"npc_dota_hero_rattletrap": 51,
	"npc_dota_hero_leshrac": 52,
	"npc_dota_hero_furion": 53,
	"npc_dota_hero_life_stealer": 54,
	"npc_dota_hero_dark_seer": 55,
	"npc_dota_hero_clinkz": 56,
	"npc_dota_hero_omniknight": 57,
	"npc_dota_hero_enchantress": 58,
	"npc_dota_hero_huskar": 59,
	"npc_dota_hero_night_stalker": 60,
	"npc_dota_hero_broodmother": 61,
	"npc_dota_hero_bounty_hunter": 62,
	"npc_dota_hero_weaver": 63,
	"npc_dota_hero_jakiro": 64,
	"npc_dota_hero_batrider": 65,
	"npc_dota_hero_chen": 66,
	"npc_dota_hero_spectre": 67,
	"npc_dota_hero_doom_bringer": 69,
	"npc_dota_hero_ancient_apparition": 68,
	"npc_dota_hero_ursa": 70,
	"npc_dota_hero_spirit_breaker": 71,
	"npc_dota_hero_gyrocopter": 72,
	"npc_dota_hero_alchemist": 73,
	"npc_dota_hero_invoker": 74,
	"npc_dota_hero_silencer": 75,
	"npc_dota_hero_obsidian_destroyer": 76,
	"npc_dota_hero_lycan": 77,
	"npc_dota_hero_brewmaster": 78,
	"npc_dota_hero_shadow_demon": 79,
	"npc_dota_hero_lone_druid": 80,
	"npc_dota_hero_chaos_knight": 81,
	"npc_dota_hero_meepo": 82,
	"npc_dota_hero_treant": 83,
	"npc_dota_hero_ogre_magi": 84,
	"npc_dota_hero_undying": 85,
	"npc_dota_hero_rubick": 86,
	"npc_dota_hero_disruptor": 87,
	"npc_dota_hero_nyx_assassin": 88,
	"npc_dota_hero_naga_siren": 89,
	"npc_dota_hero_keeper_of_the_light": 90,
	"npc_dota_hero_wisp": 91,
	"npc_dota_hero_visage": 92,
	"npc_dota_hero_slark": 93,
	"npc_dota_hero_medusa": 94,
	"npc_dota_hero_troll_warlord": 95,
	"npc_dota_hero_centaur": 96,
	"npc_dota_hero_magnataur": 97,
	"npc_dota_hero_shredder": 98,
	"npc_dota_hero_bristleback": 99,
	"npc_dota_hero_tusk": 100,
	"npc_dota_hero_skywrath_mage": 101,
	"npc_dota_hero_abaddon": 102,
	"npc_dota_hero_elder_titan": 103,
	"npc_dota_hero_legion_commander": 104,
	"npc_dota_hero_ember_spirit": 106,
	"npc_dota_hero_earth_spirit": 107,
	"npc_dota_hero_abyssal_underlord": 108,
	"npc_dota_hero_terrorblade": 109,
	"npc_dota_hero_phoenix": 110,
	"npc_dota_hero_oracle": 111,
	"npc_dota_hero_techies": 105,
	"npc_dota_hero_winter_wyvern": 112,
	"npc_dota_hero_arc_warden": 113,
	"npc_dota_hero_monkey_king": 114,
	"npc_dota_hero_dark_willow": 119,
	"npc_dota_hero_pangolier": 120,
	"npc_dota_hero_grimstroke": 121,
	"npc_dota_hero_hoodwink": 123,
	"npc_dota_hero_void_spirit": 126,
	"npc_dota_hero_snapfire": 128,
	"npc_dota_hero_mars": 129,
	"npc_dota_hero_dawnbreaker": 135,
	"npc_dota_hero_marci": 136,
	"npc_dota_hero_primal_beast": 137,
	"npc_dota_hero_muerta": 138,
	"npc_dota_hero_ringmaster": 131,
	"npc_dota_hero_kez": 145,
	"npc_dota_hero_target_dummy": 0,
}


def read_varint_bytes(buf: bytes, index: int) -> tuple[int, int]:
	value = 0
	shift = 0
	while index < len(buf):
		byte = buf[index]
		index += 1
		value |= (byte & 0x7F) << shift
		if byte & 0x80 == 0:
			return value, index
		shift += 7
		if shift > 63:
			raise ValueError("varint too long")
	raise ValueError("truncated varint")


def read_varint_file(fh) -> int | None:
	value = 0
	shift = 0
	while True:
		chunk = fh.read(1)
		if not chunk:
			return None
		byte = chunk[0]
		value |= (byte & 0x7F) << shift
		if byte & 0x80 == 0:
			return value
		shift += 7
		if shift > 63:
			raise ValueError("varint too long")


def decode_fields(buf: bytes) -> list[tuple[int, int, Any]]:
	index = 0
	fields: list[tuple[int, int, Any]] = []
	try:
		while index < len(buf):
			key, index = read_varint_bytes(buf, index)
			number = key >> 3
			wire = key & 7
			if wire == 0:
				value, index = read_varint_bytes(buf, index)
				fields.append((number, wire, value))
			elif wire == 1:
				if index + 8 > len(buf):
					break
				index += 8
				fields.append((number, wire, None))
			elif wire == 2:
				length, index = read_varint_bytes(buf, index)
				value = buf[index : index + length]
				index += length
				fields.append((number, wire, value))
			elif wire == 5:
				if index + 4 > len(buf):
					break
				index += 4
				fields.append((number, wire, None))
			else:
				break
	except ValueError:
		return fields
	return fields


def snappy_decompress(data: bytes) -> bytes:
	index = 0
	expected, index = read_varint_bytes(data, index)
	out = bytearray()
	while index < len(data):
		tag = data[index]
		index += 1
		kind = tag & 0x03
		if kind == 0:
			length = tag >> 2
			if length < 60:
				length += 1
			else:
				count = length - 59
				length = int.from_bytes(data[index : index + count], "little") + 1
				index += count
			out.extend(data[index : index + length])
			index += length
		elif kind == 1:
			length = ((tag >> 2) & 0x07) + 4
			offset = ((tag & 0xE0) << 3) | data[index]
			index += 1
			if offset == 0:
				raise ValueError("bad snappy offset")
			for _ in range(length):
				out.append(out[-offset])
		else:
			length = (tag >> 2) + 1
			if kind == 2:
				offset = int.from_bytes(data[index : index + 2], "little")
				index += 2
			else:
				offset = int.from_bytes(data[index : index + 4], "little")
				index += 4
			if offset == 0:
				raise ValueError("bad snappy offset")
			for _ in range(length):
				out.append(out[-offset])
	if expected and len(out) != expected:
		raise ValueError(f"snappy size mismatch {len(out)} != {expected}")
	return bytes(out)


def maybe_decompress(command: int, payload: bytes) -> bytes:
	if command & DEM_IS_COMPRESSED == 0:
		return payload
	return snappy_decompress(payload)


def field_value(fields: list[tuple[int, int, Any]], number: int, wire: int | None = None) -> Any:
	for item_number, item_wire, value in fields:
		if item_number == number and (wire is None or item_wire == wire):
			return value
	return None


def field_values(fields: list[tuple[int, int, Any]], number: int, wire: int | None = None) -> list[Any]:
	return [
		value
		for item_number, item_wire, value in fields
		if item_number == number and (wire is None or item_wire == wire)
	]


def parse_file_info(payload: bytes) -> dict[str, Any]:
	root = decode_fields(payload)
	game_info = field_value(root, 4, 2)
	if not game_info:
		return {}
	dota = field_value(decode_fields(game_info), 4, 2)
	if not dota:
		return {}
	info = decode_fields(dota)
	players = []
	for player_blob in field_values(info, 4, 2):
		player = decode_fields(player_blob)
		hero_name = (field_value(player, 1, 2) or b"").decode("utf-8", "replace")
		steamid = field_value(player, 4, 0)
		players.append(
			{
				"heroName": hero_name,
				"heroId": HERO_NAME_TO_ID.get(hero_name),
				"steamId": steamid,
				"team": field_value(player, 5, 0),
			}
		)
	return {"matchId": field_value(info, 1, 0), "players": players}


def extract_hero_xp_from_player(player_blob: bytes) -> int | None:
	player = decode_fields(player_blob)
	xp = field_value(player, 31, 0)
	if isinstance(xp, int) and 0 < xp <= 2_000_000:
		return xp
	return None


SVC_USER_MESSAGE = 72
DOTA_UM_MATCH_METADATA = 557
DEM_PACKET = 7
DEM_SIGNON_PACKET = 8
DEM_FULL_PACKET = 13


class BitReader:
	def __init__(self, data: bytes) -> None:
		self.data = data
		self.bit = 0

	def remaining(self) -> int:
		return len(self.data) * 8 - self.bit

	def read_bits(self, count: int) -> int:
		value = 0
		shift = 0
		while count > 0:
			if self.bit >= len(self.data) * 8:
				raise ValueError("bitstream exhausted")
			byte = self.data[self.bit >> 3]
			offset = self.bit & 7
			take = min(8 - offset, count)
			chunk = (byte >> offset) & ((1 << take) - 1)
			value |= chunk << shift
			self.bit += take
			shift += take
			count -= take
		return value

	def read_varuint32(self) -> int:
		value = 0
		shift = 0
		for _ in range(5):
			byte = self.read_bits(8)
			value |= (byte & 0x7F) << shift
			if byte & 0x80 == 0:
				return value
			shift += 7
		raise ValueError("varuint32 too long")

	def read_ubitvar(self) -> int:
		value = self.read_bits(6)
		extra = value & 0x30
		if extra == 0x10:
			return (value & 15) | (self.read_bits(4) << 4)
		if extra == 0x20:
			return (value & 15) | (self.read_bits(8) << 4)
		if extra == 0x30:
			return (value & 15) | (self.read_bits(28) << 4)
		return value

	def read_bytes(self, size: int) -> bytes:
		if self.bit & 7:
			return bytes(self.read_bits(8) for _ in range(size))
		start = self.bit >> 3
		self.bit += size * 8
		return self.data[start : start + size]


def iter_inner_messages(packet_data: bytes):
	reader = BitReader(packet_data)
	while reader.remaining() >= 14:
		try:
			kind = reader.read_ubitvar()
			size = reader.read_varuint32()
			if size < 0 or size > reader.remaining() // 8 + 4:
				break
			payload = reader.read_bytes(size)
		except ValueError:
			break
		yield kind, payload


def packet_bytes(envelope: bytes) -> bytes | None:
	fields = decode_fields(envelope)
	direct = field_value(fields, 3, 2)
	if direct:
		return direct
	full = field_value(fields, 2, 2)
	if full:
		return field_value(decode_fields(full), 3, 2)
	return None


def extract_user_metadata(payload: bytes) -> list[dict[str, Any]]:
	rows: list[dict[str, Any]] = []
	packet = packet_bytes(payload) or payload
	for kind, body in iter_inner_messages(packet):
		message = body
		if kind == SVC_USER_MESSAGE:
			user = decode_fields(body)
			if field_value(user, 1, 0) != DOTA_UM_MATCH_METADATA:
				continue
			message = field_value(user, 2, 2) or b""
		elif kind != DOTA_UM_MATCH_METADATA:
			continue
		rows.extend(extract_metadata_players(message))
	return rows


def extract_metadata_players(payload: bytes) -> list[dict[str, Any]]:
	rows: list[dict[str, Any]] = []
	try:
		root = decode_fields(payload)
	except Exception:
		return rows
	metadata = field_value(root, 3, 2)
	candidates = [payload]
	if metadata:
		candidates.append(metadata)
	for blob in candidates:
		try:
			fields = decode_fields(blob)
		except Exception:
			continue
		for team_blob in field_values(fields, 1, 2):
			try:
				team = decode_fields(team_blob)
			except Exception:
				continue
			for index, player_blob in enumerate(field_values(team, 2, 2)):
				xp = extract_hero_xp_from_player(player_blob)
				if xp is None:
					continue
				player = decode_fields(player_blob)
				rows.append(
					{
						"playerSlot": field_value(player, 3, 0),
						"teamSlot": field_value(player, 52, 0),
						"teamNumber": field_value(player, 51, 0),
						"heroId": field_value(player, 61, 0),
						"xp": xp,
						"order": index,
					}
				)
	return rows


def walk_demo(path: str) -> dict[str, Any]:
	result = {"fileName": os.path.basename(path), "matchId": None, "players": [], "plusRows": []}
	file_size = os.path.getsize(path)
	with open(path, "rb") as fh:
		magic = fh.read(8)
		if magic != b"PBDEMS2\x00":
			return result
		fh.read(8)
		while True:
			command = read_varint_file(fh)
			if command is None:
				break
			if read_varint_file(fh) is None:
				break
			size = read_varint_file(fh)
			if size is None:
				break
			payload = fh.read(size)
			if len(payload) != size:
				break
			kind = command & ~DEM_IS_COMPRESSED
			need_body = kind == DEM_FILE_INFO or kind == DEM_CUSTOM_DATA or (
				kind in (DEM_PACKET, DEM_SIGNON_PACKET, DEM_FULL_PACKET)
				and not result["plusRows"]
				and fh.tell() >= max(0, file_size - 16_000_000)
			)
			if not need_body:
				continue
			try:
				body = maybe_decompress(command, payload)
			except Exception:
				continue
			if kind == DEM_FILE_INFO:
				info = parse_file_info(body)
				result.update({key: value for key, value in info.items() if value})
			elif (
				not result["plusRows"]
				and kind in (DEM_PACKET, DEM_SIGNON_PACKET, DEM_FULL_PACKET)
				and fh.tell() >= max(0, file_size - 16_000_000)
			):
				rows = extract_user_metadata(body)
				if rows:
					result["plusRows"] = rows
			elif not result["plusRows"] and kind == DEM_CUSTOM_DATA:
				custom = decode_fields(body)
				data = field_value(custom, 2, 2)
				if data:
					rows = extract_metadata_players(data)
					if rows:
						result["plusRows"] = rows
			if result["plusRows"] and result.get("players"):
				break
	return result


PLUS_LEVEL_TOTAL_XP = [
	0, 50, 350, 750, 1250, 1850, 2750, 3750, 4850, 6050, 7350, 8750, 10450, 12250, 14150, 16150,
	18250, 20450, 22950, 25550, 28250, 31050, 33950, 36950, 40050, 46850, 50850, 55050, 59450, 64050, 72050,
]


def level_from_xp(xp: int) -> int:
	level = 1
	for next_level in range(1, len(PLUS_LEVEL_TOTAL_XP)):
		if xp >= PLUS_LEVEL_TOTAL_XP[next_level]:
			level = next_level
		else:
			break
	return min(level, 30)


def looks_like_plus_xp(values: list[int]) -> bool:
	if not values:
		return False
	in_table = sum(1 for value in values if 50 <= value <= 72050)
	return in_table >= max(1, len(values) // 2)


def collect_replays(dota_path: str, account_id: int | None) -> dict[str, Any]:
	replay_dir = os.path.join(dota_path, "game", "dota", "replays")
	summary = {
		"replayDirFound": os.path.isdir(replay_dir),
		"replaysScanned": 0,
		"matchesWithMetadata": 0,
		"heroProgressPresent": False,
		"heroes": [],
	}
	if not os.path.isdir(replay_dir):
		return summary

	steam64 = (account_id + 76561197960265728) if account_id else None
	latest: dict[int, dict[str, Any]] = {}
	files = [
		entry
		for entry in os.scandir(replay_dir)
		if entry.is_file() and entry.name.lower().endswith(".dem") and re.match(r"^\d+\.dem$", entry.name)
	]
	files.sort(key=lambda item: item.stat().st_mtime, reverse=True)
	for entry in files[:40]:
		summary["replaysScanned"] += 1
		parsed = walk_demo(entry.path)
		if not parsed.get("plusRows"):
			continue
		xp_values = [row["xp"] for row in parsed["plusRows"]]
		if not looks_like_plus_xp(xp_values):
			continue
		summary["matchesWithMetadata"] += 1
		players = parsed.get("players") or []
		radiant = [player for player in players if player.get("team") == 2]
		dire = [player for player in players if player.get("team") == 3]
		if not radiant and len(players) >= 5:
			radiant = players[:5]
			dire = players[5:10]
		for row in parsed["plusRows"]:
			side = radiant if row.get("teamNumber") == 0 else dire
			slot = row.get("teamSlot")
			player = side[slot] if isinstance(slot, int) and 0 <= slot < len(side) else None
			if steam64 and (not player or player.get("steamId") != steam64):
				continue
			if not steam64 and not player:
				continue
			hero_id = (player or {}).get("heroId") or row.get("heroId")
			if not hero_id:
				continue
			xp = int(row["xp"])
			current = latest.get(int(hero_id))
			if current and current["xp"] >= xp:
				continue
			latest[int(hero_id)] = {
				"heroId": int(hero_id),
				"level": level_from_xp(xp),
				"xp": xp,
				"matchId": parsed.get("matchId"),
				"fileName": parsed.get("fileName"),
			}
	summary["heroes"] = sorted(latest.values(), key=lambda item: (-item["xp"], item["heroId"]))
	summary["heroProgressPresent"] = len(summary["heroes"]) > 0
	return summary


def main() -> int:
	parser = argparse.ArgumentParser()
	parser.add_argument("--dota", required=True)
	parser.add_argument("--account-id", type=int, default=0)
	args = parser.parse_args()
	result = collect_replays(args.dota, args.account_id or None)
	json.dump(result, sys.stdout, ensure_ascii=True)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
