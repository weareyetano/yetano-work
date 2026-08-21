import { Migration } from '@mikro-orm/migrations'

export class Migration20260821120000 extends Migration {
  override name = 'Migration20260821120000'

  override up(): void | Promise<void> {
    this.addSql('alter table "cases" add column "status_note" text null;')
    this.addSql('alter table "cases" add column "migration_legacy_status" text null;')
    this.addSql('update "cases" set "migration_legacy_status" = "status";')
    this.addSql('alter table "cases" drop constraint "cases_status_check";')
    this.addSql(`update "cases" set "status" = case
      when "status" = 'open' then 'new'
      when "status" = 'closed' then 'resolved'
      else "status" end;`)
    this.addSql(
      `alter table "cases" add constraint "cases_status_check" check ("status" in ('canceled', 'new', 'resolved', 'waiting', 'working'));`,
    )
    this.addSql(
      `alter table "cases" add constraint "cases_status_note_check" check (("status_note" is null or (char_length("status_note") <= 2000 and btrim("status_note") <> '')) and ("status" not in ('waiting', 'canceled') or "status_note" is not null));`,
    )
    this.addSql(
      `alter table "cases" add constraint "cases_closed_at_check" check (("status" in ('resolved', 'canceled') and "closed_at" is not null) or ("status" in ('new', 'waiting', 'working') and "closed_at" is null));`,
    )

    this.addSql(
      `create table "case_status_changes" ("id" uuid not null, "actor_id" varchar(255) not null, "actor_type" text not null, "case_id" uuid not null, "case_version" int not null, "changed_at" timestamptz not null, "expected_version" int null, "from_status" text null, "note" text null, "organization_id" uuid not null, "source" text not null, "to_status" text not null, "transition_id" uuid null, "type" text not null, primary key ("id"));`,
    )
    this.addSql(
      `create index "case_status_changes_org_case_changed_idx" on "case_status_changes" ("organization_id", "case_id", "changed_at", "id");`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_org_transition_unique" unique ("organization_id", "transition_id");`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_case_fk" foreign key ("case_id") references "cases" ("id") on update cascade;`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_actor_type_check" check ("actor_type" in ('system', 'user'));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_from_status_check" check ("from_status" is null or "from_status" in ('canceled', 'new', 'resolved', 'waiting', 'working'));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_source_check" check ("source" in ('migration', 'runtime'));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_to_status_check" check ("to_status" in ('canceled', 'new', 'resolved', 'waiting', 'working'));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_type_check" check ("type" in ('created', 'transitioned'));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_note_check" check ("note" is null or (char_length("note") <= 2000 and btrim("note") <> ''));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_runtime_check" check ("source" <> 'runtime' or "type" = 'created' or ("transition_id" is not null and "expected_version" is not null));`,
    )

    this.addSql(`insert into "case_status_changes" (
      "id", "actor_id", "actor_type", "case_id", "case_version", "changed_at",
      "expected_version", "from_status", "note", "organization_id", "source",
      "to_status", "transition_id", "type"
    ) select
      gen_random_uuid(), 'case-status-migration', 'system', "id", 1, "created_at",
      null, null,
      case
        when "migration_legacy_status" = 'open'
          then 'Zmigrowano ze starego statusu „open” do „new”; wcześniejszy etap pracy jest nieznany.'
        else 'Zmigrowano początek historii sprawy ze starego statusu „closed”; wcześniejsze przejścia są nieznane.'
      end,
      "organization_id", 'migration', 'new', null, 'created'
    from "cases";`)
    this.addSql(`insert into "case_status_changes" (
      "id", "actor_id", "actor_type", "case_id", "case_version", "changed_at",
      "expected_version", "from_status", "note", "organization_id", "source",
      "to_status", "transition_id", "type"
    ) select
      gen_random_uuid(), 'case-status-migration', 'system', "id", "version",
      coalesce("closed_at", "updated_at"), null, 'new',
      'Zmigrowano ze starego statusu „closed”; historyczny wynik jest nieznany i został technicznie zmapowany na „resolved”.',
      "organization_id", 'migration', 'resolved', null, 'transitioned'
    from "cases" where "status" = 'resolved';`)
    this.addSql('alter table "cases" drop column "migration_legacy_status";')
  }

  override down(): void | Promise<void> {
    this.addSql('drop table if exists "case_status_changes" cascade;')
    this.addSql('alter table "cases" drop constraint "cases_closed_at_check";')
    this.addSql('alter table "cases" drop constraint "cases_status_note_check";')
    this.addSql('alter table "cases" drop constraint "cases_status_check";')
    this.addSql(`update "cases" set "status" = case
      when "status" in ('new', 'waiting', 'working') then 'open'
      when "status" in ('resolved', 'canceled') then 'closed'
      else "status" end;`)
    this.addSql(
      `alter table "cases" add constraint "cases_status_check" check ("status" in ('closed', 'open'));`,
    )
    this.addSql('alter table "cases" drop column "status_note";')
  }
}
