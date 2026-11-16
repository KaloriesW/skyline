"""One local server: TerrainWatch scans and Skyline's original city models."""
import importlib.util
import json
from pathlib import Path
from fastapi import HTTPException, Query
from fastapi.staticfiles import StaticFiles

HERE=Path(__file__).resolve().parent
# Prefer the tested, bundled Skyline snapshot over any unrelated parent checkout.
SKYLINE_ROOT=HERE/'skyline' if (HERE/'skyline/ui/app/server.py').is_file() else HERE.parent


def register(app,backend):
    path=SKYLINE_ROOT/'ui/app/server.py'
    spec=importlib.util.spec_from_file_location('terrain_skyline_server',path)
    skyline=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(skyline)
    app.add_api_route('/api/predict',skyline.predict,methods=['GET'])
    app.add_api_route('/api/model/cities',skyline.model_cities,methods=['GET'])
    app.add_api_route('/api/model',skyline.model_report,methods=['GET'])
    app.add_api_route('/api/typhoon',skyline.extras.typhoon,methods=['GET'])
    # No paid AI provider is required. The map's Qwen assistant stays local.
    @app.get('/api/ask/status')
    def ask_status():
        return {'enabled':False,'available':False,'message':'Use local Qwen on the landslide map.','url':'/'}

    @app.get('/api/health')
    def health():
        return {'ok':True,'version':'terrain-skyline-1','features':{
            'ask':False,'qwen':True,'typhoon':skyline.sources.typhoon_request() is not None,
            'landslide':True,'pm25':True,'pm25_cities':len(skyline.predict_state.models.available()),'mcp':False},
            'landslide_model':backend.read_selection().get('default_model')}

    @app.get('/api/landslide')
    def landslide(lat:float|None=Query(default=None,ge=21.8,le=26.5),
                  lon:float|None=Query(default=None,ge=118,le=122.1)):
        if (lat is None)!=(lon is None):raise HTTPException(400,'Provide both latitude and longitude.')
        for path in sorted(backend.RESULTS.glob('*/result.json'),key=lambda p:p.stat().st_mtime,reverse=True):
            r=json.loads(path.read_text())
            if r.get('demo_snapshot'):continue
            if lat is not None:
                west,south,east,north=r['bbox']
                if not west<=lon<=east or not south<=lat<=north:continue
            return {'status':'completed','id':r['id'],'model':r['model'],
                    'acquired':r['acquired'],'created_at':r['created_at'],'count':r['count'],
                    'center':r['center'],'bbox':r['bbox'],'width_km':r['width_km'],
                    'usable_percent':r['usable_percent'],'geojson':r['geojson'],
                    'map_url':'/terrain/?scan='+r['id'],'classification':'suspected landslide',
                    'note':'Observed satellite candidates in the displayed scan footprint. Not future risk, county-wide coverage or confirmed events.'}
        return {'status':'not_scanned','count':None,'map_url':'/terrain/',
                'note':'No saved scan covers this location. Open the map to prepare a scan.'}

    @app.on_event('shutdown')
    async def close_skyline_clients():
        for holder in (skyline.predict_state,skyline.extras.state):
            client,holder.client=holder.client,None
            if client is not None:await client.aclose()

    import workspace_assistant
    workspace_assistant.register(app,backend,skyline)

    app.mount('/skyline',StaticFiles(directory=SKYLINE_ROOT/'ui/app/web',html=True),name='skyline')
