import { Migration } from '@mikro-orm/migrations'

export class Migration20260823190000 extends Migration {
  override name = 'Migration20260823190000'

  override up(): void | Promise<void> {
    this.addSql(
      `create index "platform_outbox_aggregate_order_idx" on "platform_outbox_events" ("organization_id", "aggregate_id", "aggregate_version", "occurred_at", "id");`,
    )
    this.addSql(
      `create table "platform_event_inbox" ("id" uuid not null, "aggregate_id" varchar(255) not null, "aggregate_version" int not null, "event_id" uuid not null, "event_type" varchar(255) not null, "organization_id" uuid not null, "processed_at" timestamptz not null, "schema_version" int not null, "subscription_id" varchar(511) not null, primary key ("id"));`,
    )
    this.addSql(
      `alter table "platform_event_inbox" add constraint "platform_event_inbox_subscription_event_unique" unique ("subscription_id", "event_id");`,
    )
    this.addSql(
      `create index "platform_event_inbox_aggregate_idx" on "platform_event_inbox" ("organization_id", "aggregate_id", "aggregate_version");`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql('drop table if exists "platform_event_inbox" cascade;')
    this.addSql('drop index "platform_outbox_aggregate_order_idx";')
  }
}
