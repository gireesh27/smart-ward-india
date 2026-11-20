import { z } from "zod";
import { handler } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { storeUpload } from "@/lib/services/attachments";

const purposeSchema = z.enum(["COMPLAINT", "COMMENT", "RESOLUTION", "PROJECT_PHOTO", "PROJECT_DOCUMENT"]);

/** POST multipart/form-data: file=<binary>, purpose=<COMPLAINT|…> → { id, fileName, … } */
export const POST = handler(
  { auth: "user", rateLimit: { bucket: "upload", limit: 30, windowSec: 600, per: "user" } },
  async ({ req, actor }) => {
    if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Upload files as multipart/form-data.");
    }
    const form = await req.formData();
    const file = form.get("file");
    const purpose = purposeSchema.safeParse(form.get("purpose"));
    if (!(file instanceof File)) throw new AppError(422, "VALIDATION_ERROR", "Attach a file.");
    if (!purpose.success) throw new AppError(422, "VALIDATION_ERROR", "Unknown upload purpose.");
    return storeUpload(actor, file, purpose.data);
  },
);
