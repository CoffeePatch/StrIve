import prisma from "../prisma.js";

export async function getSeriesProgress({ userId, titleKey }) {
  const result = await prisma.$queryRaw`
    SELECT * 
    FROM user_series_progress_view 
    WHERE user_id = ${userId} AND title_key = ${titleKey};
  `;
  return result.length > 0 ? result[0] : null;
}
