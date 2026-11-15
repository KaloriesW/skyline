import json,tempfile,unittest
from pathlib import Path
from unittest.mock import Mock,patch
from fastapi import HTTPException
import geocoder

class GeocoderTests(unittest.TestCase):
    def feature(self,name='山',lat=23.5,lon=121,country='TW',osm_id=1,**props):
        return {'geometry':{'type':'Point','coordinates':[lon,lat]},'properties':{'name':name,'countrycode':country,'osm_type':'N','osm_id':osm_id,'osm_value':'peak',**props}}
    def test_foreign_invalid_and_duplicate_results_filtered(self):
        data={'features':[self.feature(),self.feature(),self.feature(country='CN',osm_id=2),self.feature(lat=90,osm_id=3),{}]}
        self.assertEqual(len(geocoder.matches(data)),1)
        for lat,lon in [(24.43,118.32),(26.16,119.94),(23.56,119.57),(22.05,121.55)]:
            self.assertEqual(len(geocoder.matches({'features':[self.feature(lat=lat,lon=lon)]})),1)
    def test_mountains_exclude_neighbouring_counties_in_rectangular_extent(self):
        data={'features':[self.feature(city='臺中市'),self.feature(osm_id=2,county='南投縣')]}
        with patch.object(geocoder,'fetch',return_value=data) as fetch:
            mountains=geocoder.mountains({'name':'台中市','extent':[120.4,24.5,121.5,23.9]})
            self.assertEqual(len(mountains),1);self.assertEqual(mountains[0]['id'],'N1')
            self.assertEqual(fetch.call_args.args[1]['include'],'osm.natural.peak')
    def test_reverse_preserves_user_coordinate_and_rejects_foreign(self):
        with patch.object(geocoder,'fetch',return_value={'features':[self.feature(lat=23.51,lon=121.01)]}):
            p=geocoder.reverse(23.5,121);self.assertEqual((p['lat'],p['lon']),(23.5,121))
        with patch.object(geocoder,'fetch',return_value={'features':[self.feature(country='CN')]}):
            with self.assertRaises(HTTPException):geocoder.reverse(24.5,118.2)
        with patch.object(geocoder,'fetch') as fetch:
            with self.assertRaises(HTTPException):geocoder.reverse(40,121)
            fetch.assert_not_called()
    def test_queries_are_taiwan_filtered_and_cached(self):
        response=Mock();response.json.return_value={'features':[self.feature()]}
        with tempfile.TemporaryDirectory() as d,patch.object(geocoder,'CACHE',Path(d)),patch.object(geocoder.requests,'get',return_value=response) as get,patch.object(geocoder.time,'sleep'):
            geocoder.search('陌生的地名');geocoder.search('陌生的地名')
            get.assert_called_once();self.assertEqual(get.call_args.kwargs['params']['countrycode'],'TW')
            self.assertIn('TerrainWatch',get.call_args.kwargs['headers']['User-Agent'])
    def test_region_lookup_excludes_industrial_name_matches(self):
        data={'features':[self.feature(name='臺中市',osm_value='city'),self.feature(name='台中電廠',osm_id=2,osm_value='industrial')]}
        with patch.object(geocoder,'fetch',return_value=data):
            self.assertEqual([p['name'] for p in geocoder.search('Taichung',region_only=True)],['臺中市'])
            self.assertEqual(len(geocoder.search('Taichung')),2)
    def test_provider_failure_is_actionable(self):
        with tempfile.TemporaryDirectory() as d,patch.object(geocoder,'CACHE',Path(d)),patch.object(geocoder.requests,'get',side_effect=geocoder.requests.Timeout),patch.object(geocoder.time,'sleep'):
            with self.assertRaises(HTTPException) as exc:geocoder.search('somewhere')
            self.assertEqual(exc.exception.status_code,503)

if __name__=='__main__':unittest.main()
