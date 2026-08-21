import { Migration } from '@mikro-orm/migrations'

export class Migration20260822090000 extends Migration {
  override name = 'Migration20260822090000'

  override up(): void | Promise<void> {
    this.addSql('drop index "cases_org_created_idx";')
    this.addSql('drop index "cases_org_status_created_idx";')
    this.addSql('drop index "cases_org_customer_created_idx";')
    this.addSql(
      'create index "cases_org_updated_idx" on "cases" ("organization_id", "updated_at", "id");',
    )
    this.addSql(
      'create index "cases_org_status_updated_idx" on "cases" ("organization_id", "status", "updated_at", "id");',
    )
    this.addSql(
      'create index "cases_org_customer_updated_idx" on "cases" ("organization_id", "customer_id", "updated_at", "id");',
    )
  }

  override down(): void | Promise<void> {
    this.addSql('drop index "cases_org_updated_idx";')
    this.addSql('drop index "cases_org_status_updated_idx";')
    this.addSql('drop index "cases_org_customer_updated_idx";')
    this.addSql(
      'create index "cases_org_created_idx" on "cases" ("organization_id", "created_at", "id");',
    )
    this.addSql(
      'create index "cases_org_status_created_idx" on "cases" ("organization_id", "status", "created_at", "id");',
    )
    this.addSql(
      'create index "cases_org_customer_created_idx" on "cases" ("organization_id", "customer_id", "created_at", "id");',
    )
  }
}
