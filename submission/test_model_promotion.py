import hashlib,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import app,mosaic,model_profiles

class PromotionTests(unittest.TestCase):
    def test_missing_release_and_wrong_checkpoint_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'models').mkdir()
            with self.assertRaises(ValueError):model_profiles.verify(root)
            data=dict(confidence=.052,tile_size=128,stride=96,imgsz=448,max_det=1000,nms_iou=.7,
                      checkpoint_sha256=hashlib.sha256(b'original').hexdigest())
            (root/'models/sentinel2448.json').write_text(json.dumps(data))
            (root/'models/sentinel2448.pt').write_bytes(b'original')
            self.assertEqual(model_profiles.verify(root)['confidence'],.052)
            (root/'models/sentinel2448.pt').write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'checksum'):model_profiles.verify(root)

    def test_promotion_waits_for_idle_and_preserves_monitor_pause(self):
        state=dict(default_model='nano448',promote_to='sentinel2448',phase='waiting_calibration')
        profile=dict(confidence=.052,checkpoint_sha256='abc')
        watch=dict(enabled=False,lat=24.16,lon=121.6,seen_scenes=['existing'],model='nano448',confidence=.35)
        with patch.object(app,'read_selection',return_value=state),patch.object(app,'read_watch',return_value=watch), \
             patch.object(app,'write_selection') as save,patch.object(app,'write_watch') as save_watch, \
             patch.object(model_profiles,'release',return_value=profile),patch.object(model_profiles,'verify',return_value=profile):
            app.ACTIVE.acquire()
            try:app.promotion_tick();save.assert_not_called()
            finally:app.ACTIVE.release()
            app.promotion_tick()
            self.assertEqual(save.call_args.args[0]['default_model'],'sentinel2448')
            result=save_watch.call_args.args[0]
            self.assertFalse(result['enabled']);self.assertEqual(result['confidence'],.052)
            self.assertEqual(result['seen_scenes'],['existing']);self.assertEqual(result['lat'],24.16)

    def test_omitted_confidence_uses_profile_and_explicit_override_survives(self):
        with patch.object(model_profiles,'profile',return_value=dict(confidence=.032)):
            values=dict(scene_id='S2C_51RUH_20261105_0_L2A',model='sentinel2448')
            self.assertEqual(app.Scan(**values).confidence,.032)
            self.assertEqual(app.Scan(**values,confidence=.025).confidence,.025)

    def test_native_rgb_uses_one_owner_and_requires_all_bands(self):
        owner=np.array([[0,1],[0,1]])
        item={'_tiles':[{'id':'a'},{'id':'b'}]}
        def read(asset,*args):
            tile,band=asset
            result=np.full((2,2),{'red':1000,'green':500,'blue':250}[band]+(100 if tile=='b' else 0),dtype=float)
            if tile=='b' and band=='blue':result[1,1]=np.nan
            return result
        with patch.object(mosaic,'quality',return_value=(None,owner)),patch.object(mosaic,'read_aligned',side_effect=read):
            rgb,valid=mosaic.native_rgb(item,None,None,(2,2),lambda i,k:(i['id'],k))
        np.testing.assert_array_equal(rgb[:,0,0],[1000,500,250])
        np.testing.assert_array_equal(rgb[:,0,1],[1100,600,350])
        self.assertFalse(valid[1,1]);self.assertTrue(valid[0,1])

    def test_rgb_transform_is_affine_invariant_and_excludes_nodata(self):
        rng=np.random.default_rng(42);rgb=rng.uniform(20,200,(128,128,3)).astype('float32')
        shifted=rgb*np.array([2,3,4])+np.array([100,500,700])
        np.testing.assert_allclose(model_profiles.rgb_to_uint8(rgb),model_profiles.rgb_to_uint8(shifted),atol=1)
        valid=np.ones((128,128),bool);valid[:10]=False
        transformed=model_profiles.rgb_to_uint8(rgb,valid)
        self.assertFalse(transformed[:10].any())

if __name__=='__main__':unittest.main()
