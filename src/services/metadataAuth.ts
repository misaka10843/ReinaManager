import { withBgmAuth } from "@/services/oauth/bgmAuthSession";
import { withHikarinagiAuth } from "@/services/oauth/hikarinagiAuthSession";
import { withNextmoeAuth } from "@/services/oauth/nextmoeAuthSession";
import type { SourceType } from "@/types";
import { AppError } from "@/utils/errors";

export interface MetadataAuthTokens {
	bgmToken?: string;
	hikarinagiToken?: string;
	nextmoeToken?: string;
}

export async function withMetadataAuth<T>(
	sources: readonly SourceType[],
	fn: (tokens: MetadataAuthTokens) => Promise<T>,
	options: { requireHikarinagi?: boolean } = {},
) {
	const sourceSet = new Set(sources);
	const runNextmoe = (bgmToken?: string, hikarinagiToken?: string) => {
		if (!sourceSet.has("nextmoe")) {
			return fn({ bgmToken, hikarinagiToken });
		}

		return withNextmoeAuth((nextmoeToken) =>
			fn({ bgmToken, hikarinagiToken, nextmoeToken }),
		);
	};

	const runHikarinagi = (bgmToken?: string) => {
		if (!sourceSet.has("hikarinagi")) {
			return runNextmoe(bgmToken);
		}

		return withHikarinagiAuth(async (hikarinagiToken) => {
			if (options.requireHikarinagi && !hikarinagiToken) {
				throw new AppError({
					code: "hikarinagi_auth_missing",
					message: "未配置 Hikarinagi 登录",
				});
			}

			return runNextmoe(bgmToken, hikarinagiToken);
		});
	};

	return sourceSet.has("bgm") ? withBgmAuth(runHikarinagi) : runHikarinagi();
}
