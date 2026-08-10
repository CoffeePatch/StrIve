import prisma from "../_lib/prisma.js";
import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Only POST is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    await prisma.user.updateMany({
      where: { id: userId },
      data: {
        simklToken: null,
        simklUserId: null,
        simklConnectedAt: null,
      },
    });

    return res.status(200).json({
      success: true,
      connected: false,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}
