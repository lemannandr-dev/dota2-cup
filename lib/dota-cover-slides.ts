const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react';

export type DotaCoverSlide = {
	src: string;
	title: string;
	line: string;
	alt: string;
};

/** Official Valve wallpapers, 3840×2160. Hotlinked, not vendored. */
export const DOTA_COVER_SLIDES: DotaCoverSlide[] = [
	{
		src: `${CDN}/international2022/persona/cm_wallpaper.jpg`,
		title: 'Кристальная дева',
		line: 'Зимний лес и волк. У каждого героя свой стиль.',
		alt: 'Кристальная дева и ледяной волк в горах Dota 2'
	},
	{
		src: `${CDN}/international2022/arcana/fv_wallpaper.jpg`,
		title: 'Драка в лесу',
		line: 'Faceless Void и Pudge. Пачка решает линию.',
		alt: 'Драка Faceless Void и Pudge в лесу Dota 2'
	},
	{
		src: `${CDN}/international2022/arcana/razor_wallpaper.jpg`,
		title: 'Шторм',
		line: 'Razor. Плазма над полем боя.',
		alt: 'Razor с грозовым клинком в Dota 2'
	},
	{
		src: `${CDN}/international2022/arcana/fv_wallpaper_02.jpg`,
		title: 'Хроносфера',
		line: 'Время встаёт. Драка решается внутри сферы.',
		alt: 'Faceless Void открывает хроносферу в Dota 2'
	},
	{
		src: `${CDN}/international2022/persona/cm_wallpaper_02.jpg`,
		title: 'Север',
		line: 'Сияние над лесом. Ночь, руны и долгий фарм.',
		alt: 'Ледяной волк Кристальной девы под северным сиянием'
	}
];
