import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import requests
import weather

class WeatherTests(unittest.TestCase):
    def raw(self):
        return {'geometry':{'coordinates':[121.6,24.16,200]},'properties':{'meta':{'updated_at':'2026-11-14T13:00:00Z','units':{'precipitation_amount':'mm','wind_speed':'m/s','air_temperature':'celsius'}},'timeseries':[{'time':weather.iso(i*3600),'data':{'instant':{'details':{'air_temperature':20,'wind_speed':2}},'next_1_hours':{'details':{'precipitation_amount':1}}}} for i in range(49)]}}
    def test_precipitation_end_alignment_and_units(self):
        d=weather.canonical(self.raw());p=weather.summarize(d,(24.16,121.6),0)
        self.assertEqual(p['precipitation_6h_mm'],6);self.assertEqual(p['precipitation_24h_mm'],24);self.assertEqual(p['precipitation_48h_mm'],48)
        self.assertEqual(p['wind_max_24h_kmh'],7.2);self.assertIsNone(p['max_hourly_precipitation_probability_24h_percent'])
        self.assertEqual(p['hourly'][0]['time'],weather.iso(3600))
    def test_missing_hours_are_unknown_not_dry(self):
        raw=self.raw();del raw['properties']['timeseries'][7]['data']['next_1_hours']
        p=weather.summarize(weather.canonical(raw),(24,121),0)
        self.assertEqual(p['precipitation_6h_mm'],6);self.assertIsNone(p['precipitation_24h_mm']);self.assertIsNone(p['precipitation_48h_mm'])
    def test_failed_service_and_partial_samples_are_explicit(self):
        payload={'data':weather.canonical(self.raw()),'fetched_at':weather.iso(0)}
        with patch.object(weather.time,'time',return_value=0),patch.object(weather,'fetch_point',side_effect=[payload,requests.Timeout('timeout')]):
            w=weather.collect([(24,121),(25,121)])
        self.assertEqual(w['status'],'partial');self.assertEqual(w['available_points'],1)
        self.assertIsNone(w['points'][1]);self.assertIn('not a prediction',weather.summary(w))
        with patch.object(weather,'fetch_point',side_effect=requests.Timeout):w=weather.collect([(24,121)])
        self.assertEqual(w['status'],'unavailable');self.assertIn('unavailable',weather.summary(w))
    def test_nearest_context_and_export_preserve_unknown(self):
        p=weather.summarize(weather.canonical(self.raw()),(24.16,121.6),0)
        w={'status':'available','points':[p],'forecast_start':weather.iso(0)}
        r={'acquired':'2026-11-05','geojson':{'features':[{'properties':{'latitude':24.16,'longitude':121.6}}]}}
        weather.attach(r,w);self.assertEqual(r['geojson']['features'][0]['properties']['forecast_precipitation_24h_mm'],24)
        with tempfile.TemporaryDirectory() as d:
            weather.save(Path(d),w);self.assertEqual(len((Path(d)/'forecast.csv').read_text().splitlines()),49)
            self.assertEqual(json.loads((Path(d)/'forecast.json').read_text())['satellite_acquired'],'2026-11-05')
        weather.attach(r,{'status':'unavailable','points':[]});self.assertIsNone(r['geojson']['features'][0]['properties']['forecast_precipitation_24h_mm'])
    def test_cache_does_not_repeat_network_before_expiry(self):
        with tempfile.TemporaryDirectory() as d,patch.object(weather,'CACHE',Path(d)),patch.object(weather.requests,'get') as get:
            get.return_value.status_code=200;get.return_value.headers={};get.return_value.json.return_value=self.raw()
            first=weather.fetch_point((24.16,121.6));second=weather.fetch_point((24.16,121.6))
            self.assertEqual(first,second);self.assertEqual(get.call_count,1)
    def test_local_grid_is_native_scale_and_overview_is_bounded(self):
        local=weather.grid_spec(121.51,24.09,121.71,24.25)
        self.assertEqual(local['step'],.1);self.assertEqual(len(local['points']),local['nx']*local['ny'])
        full=weather.grid_spec(118,21.5,122.5,26.5)
        self.assertLessEqual(len(full['points']),256)
        self.assertLess(full['step'],.5)
        with self.assertRaises(ValueError):weather.grid_spec(123,24,124,25)
        with self.assertRaises(ValueError):weather.grid_spec(float('nan'),24,122,25)
    def test_dense_grid_preserves_failed_point_slots_and_hourly_data(self):
        spec=weather.grid_spec(121.5,24.1,121.6,24.2)
        points=[None]+[{'hourly':[{'precipitation':1}]} for _ in spec['points'][1:]]
        with patch.object(weather,'collect',return_value={'points':points,'status':'partial'}):result=weather.dense_grid(spec)
        self.assertIsNone(result['points'][0]);self.assertIn('hourly',result['points'][1]);self.assertEqual(result['nx']*result['ny'],len(points))
    def test_large_area_reports_sample_the_interior(self):
        with patch.object(weather,'collect',return_value={'points':[]}) as collect:
            weather.area_forecast(24.16,121.6,60)
            points=collect.call_args.args[0]
            self.assertGreater(len(points),5);self.assertIn((24.16,121.6),points)

if __name__=='__main__':unittest.main()
