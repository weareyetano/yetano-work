import { Migration } from '@mikro-orm/migrations'

export class Migration20260828090000 extends Migration {
  override name = 'Migration20260828090000'

  override up(): void | Promise<void> {
    this.addSql(`
      do $$
      begin
        if exists (
          select 1
          from "case_status_changes" as history
          join "cases" as current_case on current_case."id" = history."case_id"
          where history."organization_id" <> current_case."organization_id"
        ) then
          raise exception 'Cannot enforce organization-scoped case history: existing history belongs to a different organization than its case.';
        end if;

        if exists (
          select 1
          from "case_status_changes"
          where "source" = 'runtime'
          group by "organization_id", "case_id", "case_version"
          having count(*) > 1
        ) then
          raise exception 'Cannot enforce unique runtime case history: duplicate organization, case, and version entries exist.';
        end if;
      end
      $$;
    `)
    this.addSql(
      'alter table "cases" add constraint "cases_org_id_unique" unique ("organization_id", "id");',
    )
    this.addSql('alter table "case_status_changes" drop constraint "case_status_changes_case_fk";')
    this.addSql(
      'alter table "case_status_changes" add constraint "case_status_changes_case_org_fk" foreign key ("organization_id", "case_id") references "cases" ("organization_id", "id") on update cascade;',
    )
    this.addSql(
      `create unique index "case_status_changes_org_case_version_runtime_unique" on "case_status_changes" ("organization_id", "case_id", "case_version") where "source" = 'runtime';`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql('drop index "case_status_changes_org_case_version_runtime_unique";')
    this.addSql(
      'alter table "case_status_changes" drop constraint "case_status_changes_case_org_fk";',
    )
    this.addSql(
      'alter table "case_status_changes" add constraint "case_status_changes_case_fk" foreign key ("case_id") references "cases" ("id") on update cascade;',
    )
    this.addSql('alter table "cases" drop constraint "cases_org_id_unique";')
  }
}
