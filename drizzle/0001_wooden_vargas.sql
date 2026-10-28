ALTER TABLE "post" ADD COLUMN "last_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "first_image_url" text;--> statement-breakpoint
UPDATE "post" SET "last_published_at" = "published_at" WHERE "published_at" IS NOT NULL;
