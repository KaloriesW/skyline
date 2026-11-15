import unittest,tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
import rasterio
from affine import Affine
import mosaic,evidence
import app

class MosaicTests(unittest.TestCase):
    def item(self,identifier,dt='2026-11-05T02:40:00Z',platform='sentinel-2c',grid=None):
        return {'id':identifier,'properties':{'datetime':dt,'platform':platform,'grid:code':grid or identifier,
            's2:datatake_id':platform+'_20261105T022851_011313_N05.13'},'assets':{'visual':{},'scl':{}}}

    def test_neighbours_same_pass_only_and_duplicate_grid_removed(self):
        primary=self.item('a',grid='north');neighbour=self.item('b',dt='2026-11-05T02:40:14Z')
        other_day=self.item('c',dt='2026-11-06T02:40:00Z')
        other_sat=self.item('d',platform='sentinel-2b')
        other_pass=self.item('e');other_pass['properties']['s2:datatake_id']='different-pass'
        duplicate=self.item('duplicate',grid='north')
        combined=mosaic.bundle(primary,[primary,neighbour,other_day,other_sat,other_pass,duplicate])
        self.assertEqual([i['id'] for i in combined['_tiles']],['a','b'])
        self.assertEqual(len(mosaic.group_passes([primary,neighbour,other_day])),2)

    def write_tile(self,folder,identifier,tr,color,scl_value,red,nir):
        item=self.item(identifier)
        for key,value,count in [('visual',color,3),('scl',scl_value,1),('red',red,1),('nir',nir,1)]:
            file=folder/f'{identifier}-{key}.tif'
            with rasterio.open(file,'w',driver='GTiff',height=6,width=8,count=count,dtype='uint16',
                               transform=tr,crs='EPSG:32651',nodata=0) as dst:
                dst.write(np.full((count,6,8),value,dtype='uint16'))
            item['assets'][key]={'href':str(file),'raster:bands':[{'nodata':0,'scale':.0001,'offset':0}]}
        return item

    def test_adjacent_rasters_fill_entire_crop_and_ndvi_has_no_seam_gap(self):
        with tempfile.TemporaryDirectory() as folder:
            folder=Path(folder);tr=Affine(10,0,350000,0,-10,2670000)
            top=self.write_tile(folder,'top',tr,100,4,1000,3000)
            bottom=self.write_tile(folder,'bottom',tr*Affine.translation(0,6),200,4,2000,8000)
            combined=mosaic.bundle(top,[bottom]);safe=lambda i,k:i['assets'][k]['href']
            scl,owner=mosaic.quality(combined,tr,'EPSG:32651',(12,8),safe)
            image,valid=mosaic.rgb(combined,tr,'EPSG:32651',(12,8),safe,owner)
            self.assertTrue(valid.all())
            np.testing.assert_array_equal(image[:,:6],100)
            np.testing.assert_array_equal(image[:,6:],200)
            self.assertTrue((owner[:6]==0).all() and (owner[6:]==1).all())
            ndvi=evidence.scene_ndvi(combined,tr,'EPSG:32651',(12,8),safe)
            np.testing.assert_allclose(ndvi[5,1:-1],.5,atol=.0001)
            np.testing.assert_allclose(ndvi[6,1:-1],.6,atol=.0001)

    def test_overlap_prefers_clear_source_without_duplicate_pixels(self):
        with tempfile.TemporaryDirectory() as folder:
            folder=Path(folder);tr=Affine(10,0,350000,0,-10,2670000)
            cloudy=self.write_tile(folder,'cloudy',tr,100,9,1000,3000)
            clear=self.write_tile(folder,'clear',tr,200,4,2000,8000)
            combined=mosaic.bundle(cloudy,[clear]);safe=lambda i,k:i['assets'][k]['href']
            image,valid=mosaic.rgb(combined,tr,'EPSG:32651',(6,8),safe)
            self.assertTrue(valid.all());np.testing.assert_array_equal(image,200)
            self.assertEqual(image.shape,(3,6,8))

    def test_missing_neighbour_remains_unassessed_instead_of_filled(self):
        with tempfile.TemporaryDirectory() as folder:
            tr=Affine(10,0,350000,0,-10,2670000)
            top=self.write_tile(Path(folder),'top',tr,100,4,1000,3000)
            combined=mosaic.bundle(top,[]);safe=lambda i,k:i['assets'][k]['href']
            image,valid=mosaic.rgb(combined,tr,'EPSG:32651',(12,8),safe)
            self.assertEqual(valid.mean(),.5)
            self.assertFalse(valid[6:].any())

    def test_monitor_marks_all_mosaic_sources_as_seen(self):
        with tempfile.TemporaryDirectory() as folder:
            state={'enabled':True,'generation':'g','active_job':'job','active_scene':'north','seen':[]}
            with patch.object(app,'WATCH_FILE',Path(folder)/'watch.json'),patch.object(app,'scan_status',return_value={
                'id':'job','state':'completed','result':{'count':2,'source_scene_ids':['north','south']}}):
                app.write_watch(state);app.monitor_tick()
                self.assertEqual(app.read_watch()['seen'],['north','south'])
                self.assertIsNone(app.read_watch()['active_job'])

if __name__=='__main__':unittest.main()
