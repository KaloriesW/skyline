import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
import rasterio
from affine import Affine
from rasterio.enums import Resampling
import evidence

class EvidenceTests(unittest.TestCase):
    def test_reflectance_offset_and_ndvi(self):
        asset={'raster:bands':[{'scale':.0001,'offset':-.1,'nodata':0}]}
        red=evidence.reflectance(np.array([[2000.,0.]]),asset)
        nir=evidence.reflectance(np.array([[8000.,8000.]]),asset)
        result=evidence.ndvi(red,nir,np.ones((1,2),bool))
        self.assertAlmostEqual(float(result[0,0]),.75)
        self.assertTrue(np.isnan(result[0,1]))

    def test_already_harmonized_cog_does_not_receive_offset_twice(self):
        asset={'raster:bands':[{'scale':.0001,'offset':-.1,'nodata':0}]}
        red=evidence.reflectance(np.array([[200.,0.]]),asset,True)
        nir=evidence.reflectance(np.array([[3000.,3000.]]),asset,True)
        result=evidence.ndvi(red,nir,np.ones((1,2),bool))
        self.assertAlmostEqual(float(result[0,0]),.875)
        self.assertTrue(np.isnan(result[0,1]))

    def test_slope_uses_metres_and_handles_flat_and_missing_data(self):
        x=np.arange(12)*30
        elevation=np.tile(x*np.tan(np.radians(30)),(12,1))
        result=evidence.slope_degrees(elevation)
        np.testing.assert_allclose(result[1:-1,1:-1],30,atol=.001)
        flat=evidence.slope_degrees(np.ones((12,12))*100)
        np.testing.assert_array_equal(flat[1:-1,1:-1],0)
        elevation[5,5]=np.nan
        self.assertTrue(np.isnan(evidence.slope_degrees(elevation)[5,5]))

    def test_paired_cloud_coverage_distinguished_from_negative_evidence(self):
        inside=np.ones((10,10),bool);before=np.full((10,10),.8);after=np.full((10,10),.2)
        after[:6]=np.nan;slope=np.full((10,10),25.)
        result=evidence.summarize(inside,before,after,slope)
        self.assertEqual(result['paired_clear_percent'],40)
        self.assertEqual(result['vegetation_check'],'unavailable')
        self.assertEqual(result['slope_check'],'supports')
        self.assertEqual(result['evidence_summary'],'incomplete')
        after[:]=.2
        result=evidence.summarize(inside,before,after,slope)
        self.assertEqual(result['evidence_summary'],'both_support')
        self.assertEqual(result['vegetation_loss_percent'],100)
        result=evidence.summarize(inside,before,before,np.zeros((10,10)))
        self.assertEqual(result['vegetation_check'],'not_supported')
        self.assertEqual(result['slope_check'],'not_supported')

    def test_reprojection_preserves_nodata_and_alignment(self):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/'test.tif';tr=Affine(10,0,350000,0,-10,2670000)
            data=np.full((8,8),12,dtype='float32');data[3:5,3:5]=-9999
            with rasterio.open(f,'w',driver='GTiff',height=8,width=8,count=1,dtype='float32',transform=tr,crs='EPSG:32651',nodata=-9999) as dst:dst.write(data,1)
            aligned=evidence.read_aligned(str(f),tr,'EPSG:32651',(8,8),Resampling.nearest)
            self.assertTrue(np.isnan(aligned[3:5,3:5]).all())
            self.assertEqual(aligned[1,1],12)

    def test_unavailable_sources_are_explicit_and_do_not_erase_detections(self):
        with tempfile.TemporaryDirectory() as d:
            shape=(10,10);tr=Affine(10,0,350000,0,-10,2670000)
            polygon=rasterio.warp.transform_geom('EPSG:32651','EPSG:4326',{'type':'Polygon','coordinates':[[[350020,2669980],[350070,2669980],[350070,2669930],[350020,2669930],[350020,2669980]]]})
            geo={'features':[{'geometry':polygon,'properties':{'confidence':.7}}]}
            with patch.object(evidence,'scene_ndvi',side_effect=ValueError('missing data')),patch.object(evidence,'terrain',side_effect=ValueError('no DEM')):
                result=evidence.analyze({'id':'scene','properties':{'datetime':'2026-11-05T00:00:00Z'}},geo,tr,'EPSG:32651',shape,[121,24,122,25],Path(d),'catalog',None,None,None,lambda *args:None)
            self.assertEqual(len(geo['features']),1)
            self.assertEqual(geo['features'][0]['properties']['confidence'],.7)
            self.assertEqual(geo['features'][0]['properties']['evidence_summary'],'incomplete')
            self.assertEqual(result['terrain_status'],'unavailable')
            self.assertEqual(len(result['warnings']),2)

if __name__=='__main__':unittest.main()
