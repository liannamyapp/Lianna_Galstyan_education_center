import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth";

/** Issues short-lived tokens so the admin's browser uploads large files (video lessons) straight to Vercel Blob. */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  if (body.type === "blob.generate-client-token") {
    const me = await getCurrentUser(); // role from the database, not the cookie
    if (me?.role !== "ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await handleUpload({
      body, request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["video/*", "audio/*", "application/pdf", "application/zip", "application/x-zip-compressed", "image/*"],
        maximumSizeInBytes: 5 * 1024 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
