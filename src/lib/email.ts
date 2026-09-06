import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSwapAgreedEmail(opts: {
  requesterEmail: string;
  requesterName: string;
  acceptedByEmail: string;
  acceptedByName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}) {
  const { requesterEmail, requesterName, acceptedByEmail, acceptedByName, shiftDate, startTime, endTime } = opts;

  const subject = `Shift swap agreed: ${shiftDate} — needs RLC approval`;
  const body = `
    <p><strong>${requesterName}</strong> and <strong>${acceptedByName}</strong> have agreed to swap the
    ${startTime}–${endTime} shift on ${shiftDate}.</p>
    <p>This isn't final yet — one of you still needs to run it by the RLC and mark it approved
    in the app once you hear back. Nothing on the schedule changes until then.</p>
  `;

  await resend.emails.send({
    from: "Shift Swapper <swaps@yourdomain.com>",
    to: [requesterEmail, acceptedByEmail],
    subject,
    html: body,
  });
}
