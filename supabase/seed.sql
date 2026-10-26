insert into resources(id,code,name,location,owner,rate_cents,currency,reviewed) values
 ('10000000-0000-4000-8000-000000000001','MIC-01','Confocal microscope','Imaging room','Aroha',12500,'NZD',true),
 ('10000000-0000-4000-8000-000000000002','FLOW-01','Flow cytometer','Cell room','Hemi',8000,'NZD',true),
 ('10000000-0000-4000-8000-000000000003','SPEC-01','Spectrometer','Analysis room','Aroha',6000,'NZD',false)
 on conflict do nothing;
insert into people(id,code,name) values
 ('20000000-0000-4000-8000-000000000001','ANA','Ana Reed'),
 ('20000000-0000-4000-8000-000000000002','BEN','Ben Patel'),
 ('20000000-0000-4000-8000-000000000003','ANA2','Ana Walker') on conflict do nothing;
insert into credentials(id,person_id,resource_id,valid_from,valid_until,evidence,assessor) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',current_date-30,current_date+60,'Demo practical assessment MIC-01','Hemi'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',current_date-180,current_date-1,'Demo expired assessment FLOW-01','Aroha') on conflict do nothing;
insert into bookings(id,code,resource_id,person_id,project,purpose,starts_at,ends_at,status,actual_minutes,rate_cents,currency) values
 ('40000000-0000-4000-8000-000000000001','B-101','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Kelp coatings','Image sample surfaces',current_date+interval '1 day 9 hours',current_date+interval '1 day 11 hours','requested',null,null,null),
 ('40000000-0000-4000-8000-000000000002','B-102','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Water cultures','Count demonstration cultures',current_date+interval '1 day 9 hours',current_date+interval '1 day 10 hours','requested',null,null,null),
 ('40000000-0000-4000-8000-000000000003','B-103','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Kelp coatings','Usage not yet recorded',current_date-interval '3 days'+interval '9 hours',current_date-interval '3 days'+interval '10 hours','approved',null,12500,'NZD'),
 ('40000000-0000-4000-8000-000000000004','B-104','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Kelp coatings','Completed imaging',current_date-interval '7 days'+interval '9 hours',current_date-interval '7 days'+interval '11 hours','completed',150,12500,'NZD') on conflict do nothing;
insert into maintenance(id,resource_id,starts_at,ends_at,reason,owner) values
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',current_date+interval '1 day 8 hours',current_date+interval '1 day 12 hours','Laser alignment check','Hemi'),
 ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',current_date-interval '5 days',current_date-interval '2 days','Service report missing','Aroha') on conflict do nothing;
