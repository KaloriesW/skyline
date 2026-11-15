import unittest,tempfile
from pathlib import Path
import numpy as np
from affine import Affine
from rasterio.features import geometry_mask
from rasterio.warp import transform_bounds
import rasterio
from shapely.geometry import Polygon,mapping
import spatial,mosaic,app,evidence

class RegionalTests(unittest.TestCase):
    def test_local_mask_preserves_holes_edge_clipping_and_evidence(self):
        tr=Affine(10,0,350000,0,-10,2670000);shape=(100,120)
        geometry=mapping(Polygon([(350010,2669990),(350400,2669990),(350400,2669600),(350010,2669600)],
            holes=[[(350100,2669900),(350200,2669900),(350200,2669800),(350100,2669800)]]))
        full=geometry_mask([geometry],shape,tr,invert=True)
        region,small=spatial.local_mask(geometry,shape,tr)
        rebuilt=np.zeros(shape,bool);rebuilt[region]=small
        np.testing.assert_array_equal(full,rebuilt);self.assertLess(small.size,full.size/2)
        outside=mapping(Polygon([(349900,2670100),(350100,2670100),(350100,2669900),(349900,2669900)]))
        clipped=geometry_mask([outside],shape,tr,invert=True)
        clip_region,clip_mask=spatial.local_mask(outside,shape,tr)
        clipped_again=np.zeros(shape,bool);clipped_again[clip_region]=clip_mask
        np.testing.assert_array_equal(clipped,clipped_again)
        before=np.full(shape,.7);after=np.full(shape,.3);slope=np.full(shape,35.)
        self.assertEqual(evidence.summarize(full,before,after,slope),
                         evidence.summarize(small,before[region],after[region],slope[region]))
    def test_sixty_km_grid_keeps_ten_meter_resolution(self):
        with tempfile.TemporaryDirectory() as d:
            file=Path(d)/'tiny.tif'
            with rasterio.open(file,'w',driver='GTiff',width=10,height=10,count=3,dtype='uint8',
                crs='EPSG:32651',transform=Affine(10,0,330000,0,-10,2700000)) as dst:
                dst.write(np.ones((3,10,10),dtype='uint8'))
            tr,crs,shape=mosaic.grid({},app.Area(lat=24.05,lon=121.45,width_km=60).bbox(),lambda *args:str(file))
            self.assertEqual(tr.a,10);self.assertEqual(tr.e,-10)
            self.assertGreater(shape[0],5900);self.assertLess(shape[0],6500)
            self.assertGreater(shape[1],5900);self.assertLess(shape[1],6500)
            with self.assertRaises(ValueError):mosaic.grid({},[120,22,122,25],lambda *args:str(file))
    def test_api_accepts_regional_width_and_rejects_unbounded_scan(self):
        self.assertEqual(app.Area(width_km=60).width_km,60)
        with self.assertRaises(ValueError):app.Area(width_km=61)

if __name__=='__main__':unittest.main()
