"""Deterministic checks for coordinate mapping, tiling, and boundary preservation."""
import unittest
import tempfile
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch
import numpy as np
from affine import Affine
from rasterio.warp import transform
from shapely.geometry import shape,Point
import app

class GeographyTests(unittest.TestCase):
    def test_overlapping_tiles_cover_every_pixel(self):
        for n in [100,224,225,600,1200,3600,6100]:
            covered=np.zeros(n,bool)
            for start in app.tile_starts(n):covered[start:start+224]=True
            self.assertTrue(covered.all())

    def test_polygon_location_and_projected_area(self):
        mask=np.zeros((20,20),bool);mask[3:10,4:12]=True
        scores=np.where(mask,.7,0)
        tr=Affine(10,0,350000,0,-10,2670000)
        result=app.make_features(mask,scores,tr,'EPSG:32651','scene','2024-04-04')
        self.assertEqual(len(result['features']),1)
        feature=result['features'][0];p=feature['properties']
        self.assertEqual(p['area_m2'],5600)
        self.assertTrue(shape(feature['geometry']).contains(Point(p['longitude'],p['latitude'])))
        x,y=transform('EPSG:4326','EPSG:32651',[p['longitude']],[p['latitude']])
        self.assertTrue(350040<=x[0]<=350120)
        self.assertTrue(2669900<=y[0]<=2669970)

    def test_holes_and_minimum_area(self):
        mask=np.zeros((20,20),bool);mask[2:12,2:12]=True;mask[5:8,5:8]=False;mask[17,17]=True
        result=app.make_features(mask,np.where(mask,.8,0),Affine(10,0,350000,0,-10,2670000),'EPSG:32651','s','d')
        self.assertEqual(len(result['features']),1)
        self.assertEqual(result['features'][0]['properties']['area_m2'],9100)
        self.assertEqual(len(result['features'][0]['geometry']['coordinates']),2)

    def test_bounds_and_dates_reject_invalid_requests(self):
        with self.assertRaises(ValueError):app.Area(lat=30)
        with self.assertRaises(ValueError):app.Search(start='2024-06-30',end='2024-04-03')
        with self.assertRaises(ValueError):app.Scan(scene_id='../../secret')

    def test_monitor_does_not_repeat_seen_scenes(self):
        state={'enabled':True,'generation':'g','lat':24.16,'lon':121.6,'width_km':6,
               'seen':['S2B_51QUG_20240404_0_L2A'],'model':'nano224','confidence':.35}
        with patch.object(app,'read_watch',return_value=state),patch.object(app,'update_watch') as update,patch.object(app,'scenes',return_value={'scenes':[{'id':state['seen'][0],'date':'2024-04-04T00:00:00Z'}]}),patch.object(app,'start_scan') as start:
            app.monitor_tick()
            start.assert_not_called()
            self.assertIn('No new scene',update.call_args.kwargs['message'])

    def test_monitor_starts_newest_scene_with_saved_configuration(self):
        state={'enabled':True,'generation':'g','lat':24.16,'lon':121.6,'width_km':6,
               'seen':[],'model':'nano224','confidence':.35}
        scenes=[{'id':'S2B_51QUG_20240404_0_L2A','date':'2024-04-04T00:00:00Z'},
                {'id':'S2B_51QUG_20240414_0_L2A','date':'2024-04-14T00:00:00Z'}]
        with patch.object(app,'read_watch',return_value=state),patch.object(app,'update_watch'),patch.object(app,'scenes',return_value={'scenes':scenes}),patch.object(app,'start_scan',return_value={'id':'job'}) as start:
            app.monitor_tick()
            start.assert_called_once()
            self.assertEqual(start.call_args.args[0].scene_id,'S2B_51QUG_20240414_0_L2A')
            self.assertEqual(start.call_args.args[0].confidence,.35)

    def test_monitor_covers_previous_revisit_and_check_now_preserves_state(self):
        with tempfile.TemporaryDirectory() as directory:
            state={'enabled':True,'generation':'g','lat':24.0966,'lon':121.5823,
                   'width_km':6,'seen':['previous'],'model':'nano224','confidence':.35,
                   'next_check':9999999999,'initialized':True}
            with patch.object(app,'WATCH_FILE',Path(directory)/'watch.json'):
                app.write_watch(state)
                app.check_watch_now()
                updated=app.read_watch()
                self.assertEqual(updated['next_check'],0)
                for key in ['seen','generation','lat','lon','model','confidence']:
                    self.assertEqual(updated[key],state[key])
                now=datetime.now(timezone.utc)
                older=(now-timedelta(days=4)).isoformat()
                def catalogue(query):
                    self.assertLessEqual(query.start,(now-timedelta(days=14)).date())
                    return {'scenes':[{'id':'S2B_51QUG_20261110_0_L2A','date':older}]}
                with patch.object(app,'scenes',side_effect=catalogue),patch.object(app,'start_scan',return_value={'id':'new'}) as start:
                    app.monitor_tick()
                    start.assert_called_once()
                    self.assertEqual(app.read_watch()['active_job'],'new')
                # Once completed, another immediate check must not rescan it.
                with patch.object(app,'scan_status',return_value={'id':'new','state':'completed','result':{'count':0}}):
                    app.monitor_tick()
                app.check_watch_now()
                with patch.object(app,'scenes',side_effect=catalogue),patch.object(app,'start_scan') as start:
                    app.monitor_tick()
                    start.assert_not_called()

    def test_check_now_requires_enabled_monitor(self):
        with patch.object(app,'read_watch',return_value={'enabled':False}):
            with self.assertRaises(app.HTTPException) as exc:app.check_watch_now()
            self.assertEqual(exc.exception.status_code,409)

class ModelPromotionTests(unittest.TestCase):
    def test_waits_for_completion_then_switches_and_refreshes_once(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);training=root/'training';training.mkdir()
            results=root/'results';results.mkdir()
            old=results/'old';old.mkdir()
            (old/'result.json').write_text(json.dumps({'center':[24.16,121.6],'width_km':6,
                'scene_id':'S2B_51QUG_20240404_0_L2A','confidence_threshold':.35}))
            weights=training/'yolo11n-seg-448/weights';weights.mkdir(parents=True)
            (weights/'best.pt').write_bytes(b'test checkpoint')
            status=training/'status_448.json';status.write_text('{"state":"training"}')
            selection=root/'selection.json';selection.write_text(json.dumps({
                'default_model':'nano224','promote_to':'nano448','phase':'waiting'}))
            watch=root/'monitor.json';watch.write_text(json.dumps({'enabled':True,'model':'nano224',
                'seen':['previous-scene'],'next_check':123,'generation':'g'}))
            with patch.object(app,'HERE',root),patch.object(app,'TRAINING',training),patch.object(app,'RESULTS',results),patch.object(app,'SELECTION_FILE',selection),patch.object(app,'WATCH_FILE',watch),patch.object(app,'start_scan',return_value={'id':'newjob'}) as start,patch.object(app,'scan_status',return_value={'id':'newjob','state':'completed'}):
                app.promotion_tick()
                start.assert_not_called()
                self.assertEqual(app.read_selection()['default_model'],'nano224')
                status.write_text('{"state":"completed"}')
                app.promotion_tick()
                self.assertEqual(app.read_selection()['default_model'],'nano448')
                self.assertEqual(app.read_watch()['model'],'nano448')
                self.assertEqual(app.read_watch()['seen'],['previous-scene'])
                self.assertEqual(app.read_watch()['next_check'],123)
                self.assertEqual((root/'models/nano448.pt').read_bytes(),b'test checkpoint')
                self.assertEqual(start.call_args.args[0].model,'nano448')
                app.promotion_tick()
                app.promotion_tick()
                start.assert_called_once()
                self.assertEqual(app.read_selection()['phase'],'completed')
                self.assertEqual(app.read_watch()['last_result'],'newjob')

if __name__=='__main__':unittest.main()
