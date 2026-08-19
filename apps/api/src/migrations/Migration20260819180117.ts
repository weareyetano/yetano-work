import { Migration } from '@mikro-orm/migrations'

export class Migration20260819180117 extends Migration {
  override name = 'Migration20260819180117'

  override up(): void | Promise<void> {
    this.addSql(
      `create table "cases" ("id" uuid not null, "closed_at" timestamptz null, "created_at" timestamptz not null, "customer_id" uuid null, "description" text null, "organization_id" uuid not null, "status" text not null, "title" varchar(200) not null, "updated_at" timestamptz not null, "version" int not null default 1, primary key ("id"));`,
    )
    this.addSql(
      `create index "cases_org_created_idx" on "cases" ("organization_id", "created_at", "id");`,
    )
    this.addSql(
      `create index "cases_org_status_created_idx" on "cases" ("organization_id", "status", "created_at", "id");`,
    )
    this.addSql(
      `create index "cases_org_customer_created_idx" on "cases" ("organization_id", "customer_id", "created_at", "id");`,
    )
    this.addSql(
      `alter table "cases" add constraint "cases_status_check" check ("status" in ('closed', 'open'));`,
    )

    this.addSql(
      `create table "platform_outbox_events" ("id" uuid not null, "actor_id" varchar(255) not null, "actor_type" text not null, "aggregate_id" varchar(255) not null, "aggregate_version" int not null, "attempts" int not null default 0, "correlation_id" varchar(255) not null, "failed_at" timestamptz null, "last_error" text null, "locked_by" varchar(255) null, "locked_until" timestamptz null, "next_attempt_at" timestamptz not null, "occurred_at" timestamptz not null, "organization_id" uuid not null, "payload" jsonb not null, "schema_version" int not null, "type" varchar(255) not null, primary key ("id"));`,
    )
    this.addSql(
      `create index "platform_outbox_ready_idx" on "platform_outbox_events" ("next_attempt_at", "occurred_at");`,
    )
    this.addSql(
      `alter table "platform_outbox_events" add constraint "platform_outbox_events_actor_type_check" check ("actor_type" in ('system', 'user'));`,
    )
  }
}
