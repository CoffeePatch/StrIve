import prisma from "../_lib/prisma.js";
import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Only GET is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        simklToken: true,
        simklUserId: true,
        simklConnectedAt: true,
      },
    });

    const isConnected = Boolean(user && user.simklToken);

    return res.status(200).json({
      connected: isConnected,
      simklUserId: isConnected ? (user.simklUserId || null) : null,
      connectedAt: isConnected && user.simklConnectedAt ? user.simklConnectedAt.toISOString() : null,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}
