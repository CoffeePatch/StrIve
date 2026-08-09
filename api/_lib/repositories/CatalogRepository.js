import prisma from "../prisma.js";

export async function getMedia({ titleKey }) {
  return prisma.catalogTitle.findUnique({
    where: { titleKey },
    include: {
      seasons: true,
      episodes: {
        orderBy: [
          { seasonNumber: "asc" },
          { episodeNumber: "asc" }
        ]
      }
    }
  });
}

export async function searchCatalog({ query, userId = null, limit = 20 }) {
  if (userId) {
    return prisma.$queryRaw`
      SELECT ct.*, 
             CASE WHEN uli.title_key IS NOT NULL THEN true ELSE false END AS "inLibrary"
      FROM catalog_titles ct 
      LEFT JOIN user_library_items uli ON ct.title_key = uli.title_key AND uli.user_id = ${userId}
      WHERE ct.title % ${query} 
      ORDER BY SIMILARITY(ct.title, ${query}) DESC 
      LIMIT ${limit};
    `;
  }
  return prisma.$queryRaw`
    SELECT ct.*, false AS "inLibrary"
    FROM catalog_titles ct 
    WHERE ct.title % ${query} 
    ORDER BY SIMILARITY(ct.title, ${query}) DESC 
    LIMIT ${limit};
  `;
}
