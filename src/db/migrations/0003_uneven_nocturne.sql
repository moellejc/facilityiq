ALTER TABLE "facilities" ADD COLUMN "address_street" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "address_city" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "address_region" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "address_postal_code" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "address_country" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_address_complete" CHECK ((
        "facilities"."address_street" is null
        and "facilities"."address_city" is null
        and "facilities"."address_region" is null
        and "facilities"."address_postal_code" is null
        and "facilities"."address_country" is null
      ) or (
        "facilities"."address_street" is not null
        and length(btrim("facilities"."address_street")) > 0
        and "facilities"."address_city" is not null
        and length(btrim("facilities"."address_city")) > 0
        and "facilities"."address_region" is not null
        and length(btrim("facilities"."address_region")) > 0
        and "facilities"."address_postal_code" is not null
        and length(btrim("facilities"."address_postal_code")) > 0
        and "facilities"."address_country" is not null
        and length(btrim("facilities"."address_country")) > 0
      ));