export interface NextmoeLocalizedText {
	value: string;
	is_machine: boolean;
}

export interface NextmoeWorkTag {
	id: string | null;
	display_name: string;
	source: string;
	tier: "core" | "longtail" | "hidden" | null;
	spoiler: "none" | "minor" | "major";
}

/** 只声明本项目实际读取的 v2 字段，不持久化整个上游返回体。 */
export interface NextmoeWork {
	object: "work";
	id: string;
	medium: string;
	display_name: string;
	latin: string | null;
	localized: Record<string, NextmoeLocalizedText>;
	olang: string;
	content_rating: string;
	content_limit: "sfw" | "nsfw";
	cover: { url: string } | null;
	titles?: Array<{
		lang: string;
		title: string;
		latin: string | null;
		title_kind: string;
		is_machine: boolean;
	}>;
	refs?: Array<{ source: string; external_id: string }>;
	intros?: Array<{
		lang: string;
		value: string;
		is_machine: boolean;
		source: string;
	}>;
	companies?: Array<{
		display_name: string;
		attribution_role: string;
	}>;
	ratings?: Array<{
		source: string;
		score: number;
		rank: number | null;
	}>;
	playtimes?: Array<{ source: string; minutes: number; vote_count: number }>;
	releases?: Array<{
		date: string | null;
		release_kind: "default" | "digital" | "physical" | "trial" | "patch";
	}>;
	tags?: NextmoeWorkTag[];
}

export interface NextmoeList<T> {
	items: T[];
	next_cursor?: string;
}

export type NextmoePlayState =
	| "wish"
	| "doing"
	| "done"
	| "on_hold"
	| "dropped";

export interface NextmoeWorkState {
	object: "work_state";
	work_id: string;
	state: NextmoePlayState;
	completion: "one_route" | "main" | "all" | null;
}

export interface NextmoeUserWork {
	object: "user_work";
	work_id: string;
	folder_ids: string[];
	work_state: NextmoeWorkState | null;
}

export interface NextmoeRatingInput {
	overall: number;
	short_summary: string;
	spoiler_level: "none" | "portion" | "serious";
}

export interface NextmoeUserRating extends NextmoeRatingInput {
	recommend: "strong_no" | "no" | "neutral" | "yes" | "strong_yes";
	aspect_scores: Partial<
		Record<
			| "art"
			| "story"
			| "music"
			| "character"
			| "route"
			| "system"
			| "voice"
			| "replay_value",
			number | null
		>
	>;
}
