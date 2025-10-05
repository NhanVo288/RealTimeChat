// emailTemplates.js

export const verifyEmailTemplate = (username, verifyLink) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your ChatApp account</title>
    <style>
      body {
        font-family: 'Inter', Roboto, Helvetica, Arial, sans-serif;
        background-color: #f4f5fb;
        margin: 0;
        padding: 0;
      }
      .email-wrapper {
        width: 100%;
        padding: 40px 0;
        background-color: #f4f5fb;
      }
      .email-content {
        width: 100%;
        max-width: 600px;
        background: #ffffff;
        margin: 0 auto;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      }
      .header {
        background: #2563eb;
        color: #fff;
        text-align: center;
        padding: 24px;
        font-size: 22px;
        font-weight: 600;
      }
      .body {
        padding: 32px;
        color: #333;
        line-height: 1.6;
      }
      .body h2 {
        color: #111827;
        font-size: 20px;
      }
      .button {
        display: inline-block;
        padding: 14px 28px;
        background: #2563eb;
        color: #fff !important;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        margin-top: 20px;
      }
      .footer {
        text-align: center;
        color: #6b7280;
        font-size: 13px;
        margin-top: 30px;
        padding-bottom: 15px;
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-content">
        <div class="header">💬 Welcome to ChatApp</div>
        <div class="body">
            <h2>Xin chào ${username},</h2>
            <p>Chào mừng bạn đến với ChatApp! Hãy bắt đầu trò chuyện cùng bạn bè của bạn. 🎉</p>
            <a href=${verifyLink} class="button">Bắt đầu ngay</a>
            <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
            Chúng tôi rất vui khi có bạn trong cộng đồng ChatApp. Hãy tận hưởng trải nghiệm và kết nối cùng mọi người!
            </p>
            <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
            Trân trọng.
            </p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
};
