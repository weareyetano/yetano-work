import { Migration } from '@mikro-orm/migrations'

export class Migration20260821180000 extends Migration {
  override name = 'Migration20260821180000'

  override up(): void | Promise<void> {
    this.dropLifecycleConstraints()
    this.addSql(
      `alter table "cases" add constraint "cases_status_check" check ("status" in ('canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'));`,
    )
    this.addSql(
      `alter table "cases" add constraint "cases_status_note_check" check (("status_note" is null or (char_length("status_note") <= 2000 and btrim("status_note") <> '')) and ("status" not in ('waiting', 'canceled') or "status_note" is not null) and ("status" <> 'postponed' or "status_note" is null));`,
    )
    this.addSql(
      `alter table "cases" add constraint "cases_closed_at_check" check (("status" in ('resolved', 'canceled') and "closed_at" is not null) or ("status" in ('new', 'postponed', 'waiting', 'working') and "closed_at" is null));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_from_status_check" check ("from_status" is null or "from_status" in ('canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_to_status_check" check ("to_status" in ('canceled', 'new', 'postponed', 'resolved', 'waiting', 'working'));`,
    )
  }

  override down(): void | Promise<void> {
    this.addSql(`do $$ begin
      if exists (select 1 from "cases" where "status" = 'postponed')
        or exists (
          select 1 from "case_status_changes"
          where "from_status" = 'postponed' or "to_status" = 'postponed'
        ) then
        raise exception 'Cannot roll back case postponement while postponed lifecycle data exists.';
      end if;
    end $$;`)
    this.dropLifecycleConstraints()
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
      `alter table "case_status_changes" add constraint "case_status_changes_from_status_check" check ("from_status" is null or "from_status" in ('canceled', 'new', 'resolved', 'waiting', 'working'));`,
    )
    this.addSql(
      `alter table "case_status_changes" add constraint "case_status_changes_to_status_check" check ("to_status" in ('canceled', 'new', 'resolved', 'waiting', 'working'));`,
    )
  }

  private dropLifecycleConstraints() {
    this.addSql('alter table "cases" drop constraint "cases_status_check";')
    this.addSql('alter table "cases" drop constraint "cases_status_note_check";')
    this.addSql('alter table "cases" drop constraint "cases_closed_at_check";')
    this.addSql(
      'alter table "case_status_changes" drop constraint "case_status_changes_from_status_check";',
    )
    this.addSql(
      'alter table "case_status_changes" drop constraint "case_status_changes_to_status_check";',
    )
  }
}
