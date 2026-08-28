import { Migration } from '@mikro-orm/migrations'

export class Migration20260828140412 extends Migration {
  override name = 'Migration20260828140412'

  override up(): void | Promise<void> {
    this.addSql(
      `create table "activities" ("id" uuid not null, "actor_id" varchar(255) not null, "actor_type" text not null, "body" text null, "case_id" uuid not null, "case_version" int null, "from_status" text null, "occurred_at" timestamptz not null, "organization_id" uuid not null, "to_status" text null, "type" text not null, primary key ("id"));`,
    )
    this.addSql(
      `create index "activities_org_case_occurred_idx" on "activities" ("organization_id", "case_id", "occurred_at", "id");`,
    )

    this.addSql(
      `alter table "activities" add constraint "activities_actor_type_check" check ("actor_type" in ('system', 'user'));`,
    )
    this.addSql(
      `alter table "activities" add constraint "activities_from_status_check" check ("from_status" in ('canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'));`,
    )
    this.addSql(
      `alter table "activities" add constraint "activities_to_status_check" check ("to_status" in ('canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'));`,
    )
    this.addSql(
      `alter table "activities" add constraint "activities_type_check" check ("type" in ('case_created', 'case_status_changed', 'note'));`,
    )
    this.addSql(`
      alter table "activities"
      add constraint "activities_shape_check"
      check (
        (
          "type" = 'note'
          and "body" is not null
          and length("body") between 1 and 10000
          and "body" = btrim("body")
          and "body" ~ '\\S'
          and "case_version" is null
          and "from_status" is null
          and "to_status" is null
        )
        or (
          "type" = 'case_created'
          and "body" is null
          and "case_version" >= 1
          and "from_status" is null
          and "to_status" is null
        )
        or (
          "type" = 'case_status_changed'
          and ("body" is null or (length("body") between 1 and 2000 and "body" = btrim("body")))
          and "case_version" >= 1
          and "from_status" is not null
          and "to_status" is not null
        )
      );
    `)
  }

  override down(): void | Promise<void> {
    this.addSql('drop table if exists "activities" cascade;')
  }
}
