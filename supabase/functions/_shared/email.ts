// Shared email helpers for Edge Functions.
//
// Single source of truth for HTML escape and the booking-confirmation email
// template. Replaces six per-function `esc()` copies and two duplicated
// `buildConfirmationEmail()` implementations.

/**
 * HTML-escapes a string for safe interpolation into email templates.
 *
 * Null-safe (treats null/undefined as empty string) and escapes the standard
 * five characters: `&`, `<`, `>`, `"`, `'`. Single quote escaping matters when
 * the value lands inside an attribute value bound by single quotes.
 */
export function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders the booking-confirmation HTML email.
 *
 * Used by both `create-checkout` (credit-booking confirmations, no Stripe
 * redirect) and `payment-webhook` (paid-booking confirmations, after Stripe
 * succeeds). The two callers used to maintain identical templates side by
 * side; this is the single source.
 */
export function buildConfirmationEmail(p: {
  studioName: string;
  className: string;
  dateStr: string;
  timeStr: string;
  instructor: string;
  location: string;
  duration: number;
  calendarUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:8px;overflow:hidden;max-width:100%;">
          <tr>
            <td style="padding:40px 48px 32px;border-bottom:1px solid #2e2e2e;">
              <p style="margin:0;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#8a7e6e;">${esc(p.studioName)}</p>
              <h1 style="margin:12px 0 0;font-size:28px;font-weight:400;color:#f5f0eb;line-height:1.2;">Your booking is confirmed</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 48px;">
              <h2 style="margin:0 0 24px;font-size:20px;font-weight:400;color:#f5f0eb;">${esc(p.className)}</h2>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2e2e2e;">
                    <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7e6e;font-family:sans-serif;">Date</span>
                    <p style="margin:4px 0 0;font-size:15px;color:#f5f0eb;">${esc(p.dateStr)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2e2e2e;">
                    <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7e6e;font-family:sans-serif;">Time</span>
                    <p style="margin:4px 0 0;font-size:15px;color:#f5f0eb;">${esc(p.timeStr)} · ${p.duration} min</p>
                  </td>
                </tr>
                ${p.instructor ? `<tr>
                  <td style="padding:10px 0;border-bottom:1px solid #2e2e2e;">
                    <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7e6e;font-family:sans-serif;">Instructor</span>
                    <p style="margin:4px 0 0;font-size:15px;color:#f5f0eb;">${esc(p.instructor)}</p>
                  </td>
                </tr>` : ""}
                ${p.location ? `<tr>
                  <td style="padding:10px 0;">
                    <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7e6e;font-family:sans-serif;">Location</span>
                    <p style="margin:4px 0 0;font-size:15px;color:#f5f0eb;">${esc(p.location)}</p>
                  </td>
                </tr>` : ""}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 48px 0;text-align:center;">
              <a href="${esc(p.calendarUrl)}" style="display:inline-block;background:#8a7e6e;color:#f5f0eb;text-decoration:none;font-family:sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;padding:12px 28px;border-radius:6px;">
                Add to Google Calendar
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px 40px;border-top:1px solid #2e2e2e;margin-top:28px;">
              <p style="margin:0;font-size:13px;color:#8a7e6e;line-height:1.6;font-family:sans-serif;">
                Need to cancel? You can cancel your booking from your dashboard. Full refunds are available up to 24 hours before class.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
