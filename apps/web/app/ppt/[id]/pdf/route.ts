import { prisma } from "@studentos/db";
import { getObjectBuffer } from "@studentos/storage";
import { getOrCreateUser } from "@/lib/user";

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/**
 * Cheap availability probe (no conversion): can we show a faithful page-PDF preview right now?
 * 200 = Gotenberg configured AND reachable AND a PPTX export exists. 503/404 otherwise.
 * The client uses this to decide between the exact PDF and the generic in-app canvas fallback.
 */
export async function HEAD(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateUser();
  if (!user) return new Response(null, { status: 401 });

  const gotenberg = process.env.GOTENBERG_URL;
  if (!gotenberg) return new Response(null, { status: 503 });

  const exp = await prisma.documentExport.findFirst({
    where: { format: "PPTX", document: { id, ownerId: user.id, type: "PPT" } },
    select: { id: true },
  });
  if (!exp) return new Response(null, { status: 404 });

  try {
    const ping = await fetch(`${gotenberg.replace(/\/$/, "")}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    return new Response(null, { status: ping.ok ? 200 : 503 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

/**
 * Slide-accurate preview: convert the deck's generated .pptx to PDF so the browser shows the
 * EXACT slides the user downloads — including an uploaded template's real design (header, logo,
 * info table). Conversion runs on the same Gotenberg service (LibreOffice in a container) the
 * report preview uses, addressed by GOTENBERG_URL. When it's unset/unreachable we return 503 and
 * the client falls back to the in-app canvas.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getOrCreateUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const gotenberg = process.env.GOTENBERG_URL;
  if (!gotenberg) return new Response("PDF rendering not configured", { status: 503 });

  const doc = await prisma.document.findFirst({
    where: { id, ownerId: user.id, type: "PPT" },
    include: { exports: { where: { format: "PPTX" }, take: 1 } },
  });
  const exp = doc?.exports[0];
  if (!doc || !exp) return new Response("Not found", { status: 404 });

  let pptx: Buffer;
  try {
    pptx = await getObjectBuffer(exp.storageKey);
  } catch {
    return new Response("Source unavailable", { status: 404 });
  }

  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(pptx)], { type: PPTX_MIME }), "deck.pptx");

  let pdf: ArrayBuffer;
  try {
    const res = await fetch(`${gotenberg.replace(/\/$/, "")}/forms/libreoffice/convert`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) return new Response("Conversion failed", { status: 502 });
    pdf = await res.arrayBuffer();
  } catch {
    return new Response("Conversion service unreachable", { status: 502 });
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="deck.pdf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
