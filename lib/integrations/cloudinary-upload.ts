/**
 * Upload helper for Instagram publishing.
 *
 * Instagram requires images to be accessible from the public internet.
 * This service uploads local files (or URL-based images) to Cloudinary
 * so they can be used in the Meta Graph API.
 *
 * Setup: add to .env:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
 *
 * To get your cloud name:
 *   1. Sign up at https://cloudinary.com (free tier: 25 credits/month)
 *   2. Go to Dashboard → Copy "Cloud Name"
 *   3. Settings → Upload → Upload presets → Add upload preset
 *      Name: syntara (or any name)
 *      Signing Mode: Unsigned
 *   4. Set NEXT_PUBLIC_CLOUDINARY_PRESET=syntara in .env
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET ?? "syntara";

/**
 * Upload an image from a URL or a File object to Cloudinary.
 * Returns the secure CDN URL for use with Instagram's Graph API.
 */
export async function uploadToCloudinary(
  source: { type: "url"; url: string } | { type: "file"; file: File }
): Promise<string> {
  if (!CLOUD_NAME) {
    throw new Error(
      "Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_PRESET to your .env file."
    );
  }

  const formData = new FormData();

  if (source.type === "url") {
    formData.append("file", source.url);
    formData.append("upload_preset", PRESET);
    formData.append("folder", "syntara");
  } else {
    formData.append("file", source.file);
    formData.append("upload_preset", PRESET);
    formData.append("folder", "syntara");
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Cloudinary upload failed: ${error?.error?.message ?? response.statusText}`
    );
  }

  const data = await response.json() as { secure_url: string };
  return data.secure_url;
}
