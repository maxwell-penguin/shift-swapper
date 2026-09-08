import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Shift Swapper <swaps@yourdomain.com>";

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
    from: FROM,
    to: [requesterEmail, acceptedByEmail],
    subject,
    html: body,
  });
}

export async function sendSwapTargetedEmail(opts: {
  targetEmail: string;
  requesterName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}) {
  const { targetEmail, requesterName, shiftDate, startTime, endTime } = opts;

  const subject = `${requesterName} wants you to cover their ${shiftDate} shift`;
  const body = `
    <p><strong>${requesterName}</strong> asked if you could cover their ${startTime}–${endTime} shift on
    ${shiftDate}.</p>
    <p>Open Shift Swapper to accept or leave it for someone else.</p>
  `;

  await resend.emails.send({
    from: FROM,
    to: [targetEmail],
    subject,
    html: body,
  });
}

export async function sendSwapApprovedEmail(opts: {
  requesterEmail: string;
  acceptedByEmail: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}) {
  const { requesterEmail, acceptedByEmail, shiftDate, startTime, endTime } = opts;

  const subject = `Shift swap approved: ${shiftDate}`;
  const body = `
    <p>Your swap for the ${startTime}–${endTime} shift on ${shiftDate} has been approved by the RLC and is
    final. The schedule has been updated.</p>
  `;

  await resend.emails.send({
    from: FROM,
    to: [requesterEmail, acceptedByEmail],
    subject,
    html: body,
  });
}

export async function sendSwapDeniedEmail(opts: {
  requesterEmail: string;
  acceptedByEmail: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
}) {
  const { requesterEmail, acceptedByEmail, shiftDate, startTime, endTime } = opts;

  const subject = `Shift swap denied: ${shiftDate}`;
  const body = `
    <p>Your swap for the ${startTime}–${endTime} shift on ${shiftDate} was denied. Nothing on the schedule
    has changed.</p>
  `;

  await resend.emails.send({
    from: FROM,
    to: [requesterEmail, acceptedByEmail],
    subject,
    html: body,
  });
}

export async function sendCycleMatchedEmail(opts: { emails: string[]; size: number }) {
  const { emails, size } = opts;

  const subject = `You've been matched in a ${size}-way shift trade`;
  const body = `
    <p>You've been matched in a ${size}-way shift trade on Shift Swapper — everyone involved gives up one
    shift and receives another, all at once.</p>
    <p>Open the Swap Market to review who's involved and confirm your part.</p>
  `;

  await resend.emails.send({ from: FROM, to: emails, subject, html: body });
}

export async function sendCycleAllAgreedEmail(opts: { emails: string[]; size: number }) {
  const { emails, size } = opts;

  const subject = `Your ${size}-way shift trade is fully agreed — needs RLC approval`;
  const body = `
    <p>Everyone in your ${size}-way shift trade has confirmed. This isn't final yet — someone still needs to
    run it by the RLC and mark it approved in the app once you hear back. Nothing on the schedule changes
    until then.</p>
  `;

  await resend.emails.send({ from: FROM, to: emails, subject, html: body });
}

export async function sendCycleApprovedEmail(opts: { emails: string[]; size: number }) {
  const { emails, size } = opts;

  const subject = `Your ${size}-way shift trade is approved`;
  const body = `
    <p>Your ${size}-way shift trade has been approved by the RLC and is final. The schedule has been
    updated for everyone involved.</p>
  `;

  await resend.emails.send({ from: FROM, to: emails, subject, html: body });
}

export async function sendCycleDeniedEmail(opts: { emails: string[]; size: number }) {
  const { emails, size } = opts;

  const subject = `Your ${size}-way shift trade was denied`;
  const body = `
    <p>Your ${size}-way shift trade was denied. Nothing on the schedule has changed, and everyone's shift
    is back on the swap market.</p>
  `;

  await resend.emails.send({ from: FROM, to: emails, subject, html: body });
}
