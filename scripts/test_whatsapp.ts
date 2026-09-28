import "../server/env";

/**
 * Diagnostic test script for WhatsApp Meta Cloud API configuration.
 *
 * Usage:
 *   npx tsx scripts/test_whatsapp.ts [optional_phone_number]
 *
 * Example:
 *   npx tsx scripts/test_whatsapp.ts +919876543210
 */

const token =
  process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || "";
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || "";
const targetPhone = process.argv[2] || process.env.TEST_PHONE || "";

function maskString(str: string, keepStart = 4, keepEnd = 4): string {
  if (!str) return "<NOT SET>";
  if (str.length <= keepStart + keepEnd) return "***";
  return `${str.slice(0, keepStart)}...${str.slice(-keepEnd)} (${str.length} chars)`;
}

async function runDiagnostics() {
  console.log("==================================================");
  console.log("       BLUEPIN WHATSAPP CONFIG DIAGNOSTICS        ");
  console.log("==================================================");
  console.log(
    `Node Environment:           ${process.env.NODE_ENV || "development"}`,
  );
  console.log(`WHATSAPP_PHONE_NUMBER_ID:   ${maskString(phoneId, 4, 3)}`);
  console.log(`WHATSAPP_TOKEN:             ${maskString(token, 8, 4)}`);
  console.log(
    `WHATSAPP_OTP_TEMPLATE_NAME: ${templateName || "<NOT SET (using text fallback)>"}`,
  );
  console.log(
    `Target Phone:               ${targetPhone || "<NONE PROVIDED>"}`,
  );
  console.log("--------------------------------------------------\n");

  if (!token) {
    console.error(
      "❌ ERROR: WHATSAPP_TOKEN (or WHATSAPP_ACCESS_TOKEN) is missing in your .env file!",
    );
    return;
  }

  if (!phoneId) {
    console.error(
      "❌ ERROR: WHATSAPP_PHONE_NUMBER_ID is missing in your .env file!",
    );
    return;
  }

  // 1. Verify Token & Phone Number ID with Meta Graph API
  console.log("🔍 Step 1: Testing Meta API Token & Phone ID validity...");
  const versions = ["26.0", "v26.0"];
  let workingVersion = "26.0";
  let tokenValid = false;

  for (const v of versions) {
    const url = `https://graph.facebook.com/${v}/${phoneId}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (res.ok) {
        console.log(`✅ Success via Graph API ${v}!`);
        console.log("   Phone Number Details from Meta:");
        console.log(`   - Verified Name:    ${data.verified_name || "N/A"}`);
        console.log(
          `   - Display Phone:    ${data.display_phone_number || "N/A"}`,
        );
        console.log(`   - Quality Rating:   ${data.quality_rating || "N/A"}`);
        console.log(`   - Platform Type:    ${data.platform_type || "N/A"}`);
        workingVersion = v;
        tokenValid = true;
        break;
      } else {
        console.error(`❌ Meta returned an error with ${v}:`);
        console.error(`   HTTP Status: ${res.status}`);
        console.error("   Response:", JSON.stringify(data, null, 2));

        if (data?.error?.code === 190) {
          console.log("\n💡 TROUBLESHOOTING CODE 190:");
          console.log(
            "   • The token is expired, invalid, or belongs to a different app/business.",
          );
          console.log(
            "   • If using a System User token, ensure the System User has been assigned",
          );
          console.log(
            "     the WhatsApp Business Account asset with Full Control.",
          );
          console.log(
            "   • Ensure the token has 'whatsapp_business_messaging' permission enabled.",
          );
        }
      }
    } catch (err: any) {
      console.error(
        `❌ Network error while connecting to Meta Graph API (${v}):`,
        err.message,
      );
    }
  }

  if (!tokenValid) {
    console.log(
      "\n⚠️ Token validation failed. Cannot proceed to send test messages.",
    );
    return;
  }

  // 2. If a target phone number is provided, try sending a message
  if (!targetPhone) {
    console.log("\nℹ️ To test sending an actual message, run:");
    console.log("   npx tsx scripts/test_whatsapp.ts <your_phone_number>");
    console.log("   (e.g., npx tsx scripts/test_whatsapp.ts +919876543210)");
    return;
  }

  const cleanTo = targetPhone.replace(/\D/g, "");
  console.log(`\n🚀 Step 2: Attempting to send test message to: +${cleanTo}`);

  // Try text message first
  const sendUrl = `https://graph.facebook.com/${workingVersion}/${phoneId}/messages`;
  const testOtp = "123456";
  const textBody =
    `🔒 *${testOtp}* is your Bluepin verification code.\n\n` +
    `For your security, do not share this code with anyone. It expires in 5 minutes.`;

  console.log("   Sending direct text message payload...");
  try {
    const textRes = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: { body: textBody, preview_url: false },
      }),
    });

    const textData = await textRes.json();
    if (textRes.ok) {
      console.log("✅ DIRECT TEXT MESSAGE SENT SUCCESSFULLY!");
      console.log("   Message ID:", textData.messages?.[0]?.id);
      return;
    } else {
      console.warn(
        "⚠️ Direct text message failed with response:",
        JSON.stringify(textData, null, 2),
      );

      // Check if it failed due to 24-hr customer service window (requires template)
      console.log(
        "\n   Falling back to standard Meta 'hello_world' template test...",
      );
      const templateRes = await fetch(sendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "template",
          template: {
            name: "hello_world",
            language: { code: "en_US" },
          },
        }),
      });

      const templateData = await templateRes.json();
      if (templateRes.ok) {
        console.log("✅ 'hello_world' TEMPLATE MESSAGE SENT SUCCESSFULLY!");
        console.log("   Message ID:", templateData.messages?.[0]?.id);
        console.log(
          "\n💡 Note: Because the template worked but direct text did not, you need to:",
        );
        console.log(
          "   Create an approved Authentication / OTP template in WhatsApp Manager and set",
        );
        console.log(
          "   WHATSAPP_OTP_TEMPLATE_NAME=<template_name> in your .env file.",
        );
      } else {
        console.error(
          "❌ 'hello_world' template also failed:",
          JSON.stringify(templateData, null, 2),
        );
      }
    }
  } catch (err: any) {
    console.error("❌ Network error sending message:", err.message);
  }
}

runDiagnostics();
