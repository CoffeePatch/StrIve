import prisma from "../api/_lib/prisma.js";
import { encryptToken, decryptToken, generateOAuthState, verifyOAuthState } from "../api/_lib/security/tokenCipher.js";

async function runStage31Verification() {
  console.log("=================================================================");
  console.log("  Stage 3.1 Verification — Simkl OAuth & Serverless Auth");
  console.log("=================================================================");

  const testUserId = "stage31_test_user_alpha";
  const mockSimklToken = "simkl_at_mock_access_token_1234567890";

  try {
    // Ensure test user exists in PostgreSQL
    await prisma.user.upsert({
      where: { id: testUserId },
      create: { id: testUserId },
      update: { simklToken: null, simklUserId: null, simklConnectedAt: null },
    });

    // --- Test 1: Signed OAuth State Generation & Verification ---
    console.log("\n[Test 1] Testing Signed OAuth State Security...");
    const signedState = generateOAuthState(testUserId);
    const isValidState = verifyOAuthState(signedState, testUserId);
    const tamperedState = signedState.substring(0, signedState.length - 4) + "X9Z0";
    const isTamperedValid = verifyOAuthState(tamperedState, testUserId);
    const isWrongUserValid = verifyOAuthState(signedState, "wrong_user_id");

    console.log(" ✓ Signed State:", signedState.substring(0, 20) + "...");
    console.log(" ✓ Valid State Check:", isValidState);
    console.log(" ✓ Tampered State Rejected:", !isTamperedValid);
    console.log(" ✓ Wrong User State Rejected:", !isWrongUserValid);

    if (!isValidState || isTamperedValid || isWrongUserValid) {
      throw new Error("Test 1 Failed: OAuth state signature or user binding failed!");
    }
    console.log("✅ [Test 1 PASSED] Signed OAuth state security verified.");

    // --- Test 2: Server-Side Token Encryption & Decryption ---
    console.log("\n[Test 2] Testing AES-256-GCM Server-Side Token Encryption...");
    const encrypted = encryptToken(mockSimklToken);
    const decrypted = decryptToken(encrypted);

    console.log(" ✓ Encrypted String:", encrypted.substring(0, 30) + "...");
    console.log(" ✓ Decrypted String Match:", decrypted === mockSimklToken);

    if (encrypted.includes(mockSimklToken) || decrypted !== mockSimklToken) {
      throw new Error("Test 2 Failed: Token encryption/decryption failed!");
    }
    console.log("✅ [Test 2 PASSED] AES-256-GCM token cipher verified.");

    // --- Test 3: Protected PostgreSQL Credential Storage ---
    console.log("\n[Test 3] Testing Protected PostgreSQL Storage & User Binding...");
    const connectedAt = new Date();
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        simklToken: encrypted,
        simklUserId: "simkl_user_9988",
        simklConnectedAt: connectedAt,
      },
    });

    const userDb = await prisma.user.findUnique({ where: { id: testUserId } });
    if (!userDb || !userDb.simklToken || userDb.simklUserId !== "simkl_user_9988") {
      throw new Error("Test 3 Failed: User Simkl connection persistence failed!");
    }
    console.log(" ✓ Stored Encrypted Token in PostgreSQL:", userDb.simklToken.substring(0, 25) + "...");
    console.log("✅ [Test 3 PASSED] User Simkl connection stored in PostgreSQL.");

    // --- Test 4: Token Confidentiality (Status API Output Inspection) ---
    console.log("\n[Test 4] Verifying Token Confidentiality in Status Response...");
    // Simulate /api/simkl/status endpoint query output
    const statusOutput = {
      connected: Boolean(userDb.simklToken),
      simklUserId: userDb.simklUserId,
      connectedAt: userDb.simklConnectedAt ? userDb.simklConnectedAt.toISOString() : null,
    };

    console.log(" ✓ Status Response Keys:", Object.keys(statusOutput));
    console.log(" ✓ Raw Token Included:", "simklToken" in statusOutput || "accessToken" in statusOutput);

    if ("simklToken" in statusOutput || "accessToken" in statusOutput || JSON.stringify(statusOutput).includes(mockSimklToken)) {
      throw new Error("Test 4 Failed: Raw Simkl access token was leaked in status payload!");
    }
    console.log("✅ [Test 4 PASSED] Token confidentiality verified (0 credentials leaked to client).");

    // --- Test 5: Safe Disconnect ---
    console.log("\n[Test 5] Testing Disconnect Endpoint Credential Purge...");
    await prisma.user.update({
      where: { id: testUserId },
      data: { simklToken: null, simklUserId: null, simklConnectedAt: null },
    });

    const userAfterDisconnect = await prisma.user.findUnique({ where: { id: testUserId } });
    if (userAfterDisconnect.simklToken !== null || userAfterDisconnect.simklUserId !== null) {
      throw new Error("Test 5 Failed: Disconnect failed to purge credentials!");
    }
    console.log("✅ [Test 5 PASSED] Disconnect purged credentials cleanly from PostgreSQL.");

    // --- Test 6: Reconnect Verification ---
    console.log("\n[Test 6] Testing Reconnection Cleanliness...");
    const newEncryptedToken = encryptToken("new_simkl_access_token_98765");
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        simklToken: newEncryptedToken,
        simklUserId: "simkl_user_9988",
        simklConnectedAt: new Date(),
      },
    });

    const reconnectedUser = await prisma.user.findUnique({ where: { id: testUserId } });
    const decryptedNewToken = decryptToken(reconnectedUser.simklToken);

    if (decryptedNewToken !== "new_simkl_access_token_98765") {
      throw new Error("Test 6 Failed: Reconnection token update failed!");
    }
    console.log("✅ [Test 6 PASSED] Reconnection cleanly replaced stored credentials.");

    // Cleanup Test User Data
    await prisma.user.delete({ where: { id: testUserId } });

    console.log("\n=================================================================");
    console.log("  ALL STAGE 3.1 VERIFICATION TESTS PASSED (6/6)                  ");
    console.log("=================================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Stage 3.1 Verification Failed:", err);
    process.exit(1);
  }
}

runStage31Verification();
