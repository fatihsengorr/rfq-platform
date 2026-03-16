const APP_NAME = "RFQ Platform";

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf6f1;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e8ddd0;overflow:hidden">
    <div style="background:linear-gradient(135deg,#d4924b,#c17d3a);padding:20px 24px">
      <h1 style="margin:0;color:#fff;font-size:18px">${APP_NAME}</h1>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px;font-size:16px;color:#2c1810">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 24px;background:#faf6f1;text-align:center;font-size:12px;color:#8a7968">
      This is an automated message from ${APP_NAME}
    </div>
  </div>
</body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#d4924b;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">${label}</a>`;
}

export function assignmentNotification(
  projectName: string,
  assignedByName: string,
  rfqUrl: string,
): { subject: string; html: string } {
  return {
    subject: `New assignment: ${projectName}`,
    html: layout(
      "You have been assigned to an RFQ",
      `<p style="margin:0;color:#4a3f35;font-size:14px;line-height:1.6">
        <strong>${assignedByName}</strong> has assigned you to work on <strong>${projectName}</strong>.
        Please review the request details and start pricing.
      </p>
      ${button(rfqUrl, "View Request")}`,
    ),
  };
}

export function quoteSubmittedNotification(
  projectName: string,
  versionNumber: number,
  submittedByName: string,
  rfqUrl: string,
): { subject: string; html: string } {
  return {
    subject: `Quote V${versionNumber} submitted: ${projectName}`,
    html: layout(
      "A quote revision needs your approval",
      `<p style="margin:0;color:#4a3f35;font-size:14px;line-height:1.6">
        <strong>${submittedByName}</strong> has submitted <strong>Version ${versionNumber}</strong> for <strong>${projectName}</strong>.
        Please review and approve or request a revision.
      </p>
      ${button(rfqUrl, "Review Quote")}`,
    ),
  };
}

export function approvalDecisionNotification(
  projectName: string,
  versionNumber: number,
  decision: "APPROVED" | "REJECTED",
  comment: string,
  decidedByName: string,
  rfqUrl: string,
): { subject: string; html: string } {
  const isApproved = decision === "APPROVED";
  const decisionLabel = isApproved ? "approved" : "rejected";
  const statusColor = isApproved ? "#2d6a1e" : "#882f2f";

  return {
    subject: `Quote V${versionNumber} ${decisionLabel}: ${projectName}`,
    html: layout(
      `Quote revision has been ${decisionLabel}`,
      `<p style="margin:0;color:#4a3f35;font-size:14px;line-height:1.6">
        <strong>${decidedByName}</strong> has <span style="color:${statusColor};font-weight:700">${decisionLabel}</span>
        <strong>Version ${versionNumber}</strong> for <strong>${projectName}</strong>.
      </p>
      ${comment ? `<div style="margin-top:12px;padding:12px;background:#faf6f1;border-radius:8px;border-left:3px solid ${statusColor}"><p style="margin:0;font-size:13px;color:#4a3f35"><strong>Comment:</strong> ${comment}</p></div>` : ""}
      ${button(rfqUrl, "View Details")}`,
    ),
  };
}

export function deadlineWarningNotification(
  projectName: string,
  deadline: string,
  rfqUrl: string,
): { subject: string; html: string } {
  const deadlineDate = new Date(deadline).toLocaleString("en-GB");

  return {
    subject: `Deadline approaching: ${projectName}`,
    html: layout(
      "RFQ deadline is approaching",
      `<p style="margin:0;color:#4a3f35;font-size:14px;line-height:1.6">
        The deadline for <strong>${projectName}</strong> is <strong>${deadlineDate}</strong>.
        Please ensure all required actions are completed before the deadline.
      </p>
      ${button(rfqUrl, "View Request")}`,
    ),
  };
}
