-- PostgreSQL numeric dopuszcza NaN; koszt i stawka muszą być rzeczywistymi kwotami.
alter table public.slm_events add constraint slm_events_finite_costs
 check(hourly_rate<>'NaN'::numeric and total_cost<>'NaN'::numeric);
