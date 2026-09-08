import { db } from "./db";

export async function notify(opts: {
  userId: string;
  groupId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
}) {
  await db.notification.create({ data: { ...opts } });
}
