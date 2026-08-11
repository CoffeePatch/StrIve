import * as progressRepository from "../repositories/ProgressRepository.js";
import { ServiceError } from "./libraryService.js";

export async function getSeriesProgress(userId, titleKey) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!titleKey) throw new ServiceError(400, "TitleKey is required");

  const progress = await progressRepository.getSeriesProgress({ userId, titleKey });
  return progress;
}
