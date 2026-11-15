import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from rasterio.warp import transform_geom
from shapely.geometry import box,mapping,LineString
from fastapi.testclient import TestClient
import roads,app

class RoadTests(unittest.TestCase):
    def geometry(self,g):return transform_geom('EPSG:32651','EPSG:4326',mapping(g))
    def feature(self):return {'type':'Feature','geometry':self.geometry(box(300000,2600000,300100,2600100)),'properties':{'id':1,'confidence':.7}}
    def way(self,x,kind='primary',id=1):
        c=self.geometry(LineString([(x,2599900),(x,2600200)]))['coordinates']
        return {'type':'way','id':id,'tags':{'name':'測試道路','ref':'台8','highway':kind},'geometry':[{'lon':lon,'lat':lat} for lon,lat in c]}
    def payload(self,*ways):return {'data':{'elements':list(ways)},'fetched_at':'2026-11-15T00:00:00Z'}
    def test_distance_is_polygon_to_line_in_metres_and_nearest_is_selected(self):
        geo={'features':[self.feature()]}
        result=roads.annotate(geo,[121,23,122,24],self.payload(self.way(300400,id=2),self.way(300150)))
        p=geo['features'][0]['properties'];self.assertAlmostEqual(p['road_distance_m'],50,delta=.1)
        self.assertEqual(p['nearest_road_osm_id'],1);self.assertTrue(p['near_road']);self.assertEqual(result['near_count'],1)
        self.assertEqual(len(result['geojson']['features']),1)
    def test_crossing_is_zero_and_not_a_blockage_claim(self):
        geo={'features':[self.feature()]};result=roads.annotate(geo,[121,23,122,24],self.payload(self.way(300050)))
        self.assertEqual(geo['features'][0]['properties']['road_distance_m'],0)
        self.assertIn('not a blockage',result['limitations'])
    def test_radius_and_footpaths(self):
        for way in [self.way(302500),self.way(300050,kind='footway')]:
            geo={'features':[self.feature()]};roads.annotate(geo,[121,23,122,24],self.payload(way))
            p=geo['features'][0]['properties'];self.assertEqual(p['road_proximity_status'],'not_found');self.assertIsNone(p['road_distance_m'])
    def test_failure_preserves_detections_and_is_not_no_roads(self):
        geo={'features':[self.feature()]}
        with patch.object(roads,'fetch',side_effect=TimeoutError('timeout')):result=roads.analyze(geo,[121,23,122,24])
        self.assertEqual(result['status'],'unavailable');self.assertEqual(len(geo['features']),1)
        self.assertEqual(geo['features'][0]['properties']['confidence'],.7)
        self.assertEqual(geo['features'][0]['properties']['road_proximity_status'],'unavailable')
    def test_saved_scan_enrichment_exports_and_does_not_run_yolo(self):
        identifier='f'*32;result={'id':identifier,'bbox':[121,23,122,24],'geojson':{'features':[self.feature()]}}
        with tempfile.TemporaryDirectory() as tmp,patch.object(app,'RESULTS',Path(tmp)),patch.object(app,'scan_status',return_value={'state':'completed','result':result}),patch.object(roads,'fetch',return_value=self.payload(self.way(300150))),patch.object(app,'start_scan') as scan:
            directory=Path(tmp)/identifier;directory.mkdir();client=TestClient(app.app)
            r=client.post(f'/api/scans/{identifier}/roads');self.assertEqual(r.status_code,200,r.text)
            self.assertEqual(r.json()['geojson']['features'][0]['properties']['road_distance_m'],50)
            self.assertIn('road_distance_m',(directory/'coordinates.csv').read_text())
            self.assertEqual(json.loads((directory/'result.json').read_text())['roads']['status'],'available');scan.assert_not_called()
            with patch.object(roads,'fetch') as fetch:
                self.assertEqual(client.post(f'/api/scans/{identifier}/roads').status_code,200);fetch.assert_not_called()
    def test_empty_scan_skips_network(self):
        with patch.object(roads,'fetch') as fetch:
            self.assertEqual(roads.analyze({'features':[]},[121,23,122,24])['status'],'not_needed');fetch.assert_not_called()

if __name__=='__main__':unittest.main()
