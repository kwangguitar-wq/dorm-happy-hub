# Dorm Happy Hub

ช่วยสร้าง ระบบจัดการหอพักที่มาพร้อมฟังก์ชันที่ครบครัน

ภายในมีฟังก์ชั่นต่างๆดังนี้

1.ระบบล็อกอิน

2.แดชบอร์ด 

3.จัดการผู้เช่ารายวัน

4.จัดการผู้เช่ารายเดือน

5.บันทึกมิเตอร์และสร้างบิลค่าน้ำ/ค่าไฟ

6.ใบเสร็จและใบกำกับภาษี

7.การแจ้งและตรวจสอบการชำระเงิน

8.ระบบแจ้งซ่อม

9.ระบบรายงานผล

10.ระบบอีเมล

11.ระบบจัดการผู้ใช้งาน

12.ระบบรักษาความปลอดภัย (PIN)

13.ระบบการตั้งค่า

14.Responsive รองรับการใช้งานจากทุกอุปกรณ์ อยู่ที่ไหนก็ใช้ได้ 

สามารถดูตัวอย่างได้ที่ https://testrentalsystem.alwaysdata.net/pages/dashboard.php

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dorm-happy-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c88c7b19-c59c-4af4-ab07-10a1b22a59c7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Vercel deployment and environment setup

This application uses TanStack Start, Vite, and Supabase. Import this repository into Vercel and configure the production branch as `main`. Use the repository's detected framework/build settings; verify the build output before assigning a production domain.

Copy the variable names from `.env.example` into Vercel Project Settings → Environment Variables. Set Supabase URL and publishable key for the browser and server as appropriate. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never prefix it with `VITE_` and never expose it to browser code.

## LINE Messaging API setup

Create or use a LINE Official Account and enable the Messaging API in LINE Developers. Configure these values in Vercel Environment Variables (Production and Preview as needed):

- `LINE_CHANNEL_ACCESS_TOKEN`: channel access token (server-side only)
- `LINE_CHANNEL_SECRET`: channel secret used to verify webhook signatures
- `LINE_ADMIN_USER_ID`: LINE user ID for the dorm manager
- `LINE_DORM_GROUP_ID`: LINE group ID for the dorm management group

The implemented webhook URL is:

`https://dorm-happy-hub.vercel.app/api/line/webhook`

After the latest deployment is ready, paste that URL into LINE Developers → Messaging API → Webhook URL and enable **Use webhook**. Invite the LINE Official Account into the dorm management group. Send the text `ID` to the Official Account (in a private chat or the group); the bot replies with the LINE user/group ID. Put that value in `LINE_ADMIN_USER_ID` for a private admin chat, or `LINE_DORM_GROUP_ID` for the group. If both are set, the group ID is used.

The app sends manager notifications when a bill is created, a tenant submits a payment, or a tenant creates a repair request. LINE notifications are sent from the server only; the channel access token and channel secret must never use a `VITE_` prefix or be exposed in browser code. A failed LINE send does not cancel a saved bill, payment notice, or repair request.

Tenants must add the Official Account as a friend and explicitly link their LINE account to their tenant profile before any future private tenant notifications can be sent.

**Security note:** Environment files must not be committed. If a real `.env` file was previously committed, deleting it from the latest commit does not erase it from Git history. Rotate every credential that was present in that file, especially Supabase service-role keys and any LINE tokens, before production use.
