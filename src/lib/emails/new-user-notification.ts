export function buildNewUserNotificationHtml(
  firstName: string,
  lastName: string
): string {
  const fullName = [firstName, lastName].filter(Boolean).join(" ")
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 32px; margin: 0;">
      <div style="max-width: 480px; margin: 0 auto; background: #16213e; border-radius: 12px; padding: 32px; border: 1px solid #2a2a4a;">
        <h1 style="color: #ffffff; font-size: 22px; margin-top: 0;">New Family Member!</h1>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          <strong style="color: #4fc3f7;">${fullName}</strong> just signed up for the family tree.
        </p>
        <p style="font-size: 14px; color: #9e9e9e; margin-bottom: 0;">
          Log in to see who's new and start connecting.
        </p>
      </div>
    </body>
    </html>
  `
}
