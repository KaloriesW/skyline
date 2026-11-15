"""Compatibility checks for the integrated Skyline v2 update; no live services."""
import asyncio
from datetime import date
import json
import math
import httpx
from fastapi.testclient import TestClient
import app
import skyline_integration


def test_all_city_models_and_reports_are_usable_through_merged_api(monkeypatch):
    client = TestClient(app.app)
    endpoint = next(r.endpoint for r in app.app.routes if getattr(r, 'path', '') == '/api/predict')
    pm = endpoint.__globals__['airmodel']
    state = endpoint.__globals__['predict_state']
    fixture = json.loads((skyline_integration.SKYLINE_ROOT / 'ui/app/model/fixtures/taichung_parity.json').read_text())
    calls = []

    def upstream(request):
        calls.append(request)
        if request.url.host == 'api.open-meteo.com':
            return httpx.Response(200, json=fixture['wx'])
        return httpx.Response(200, json=fixture['up'] if ',' in request.url.params['latitude'] else fixture['aq'])

    state.reset()
    monkeypatch.setattr(state, 'today', lambda: date(2026, 11, 7))
    state.client = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
    try:
        cities = client.get('/api/model/cities').json()
        assert len(cities['cities']) == 22 and cities['missing'] == []
        assert client.get('/api/health').json()['features']['pm25_cities'] == 22
        for city in cities['cities']:
            assert city['has_model'] and state.models.model(city['id']) is not None
            report = client.get('/api/model', params={'city': city['id']})
            assert report.status_code == 200
            report = report.json()
            assert report['chosen'] == city['chosen']
            for target in ('pm25', 'pm10'):
                assert round(report['results'][target][city['chosen'][target]]['mae'], 3) == city[target]['model_mae']
            # Shared recorded inputs test interface compatibility, not city-specific accuracy.
            response = client.get('/api/predict', params={'lat': city['lat'], 'lon': city['lon']})
            assert response.status_code == 200, (city['id'], response.text)
            prediction = response.json()
            assert prediction['city']['id'] == city['id']
            assert prediction['model']['kind'] == city['chosen']['pm25']
            assert prediction['date'] == '2026-11-08'
            assert all(math.isfinite(prediction[k]) and prediction[k] >= 0 for k in ('pm25', 'pm10'))
        assert len([r for r in calls if ',' in r.url.params['latitude']]) == 1
        assert client.get('/api/ask/status').json()['url'] == '/'
        html = client.get('/skyline/').text
        assert 'Ask Qwen' in html and 'Landslide map' in html
        js = client.get('/skyline/app.js').text
        assert 'terrain-scan' in js and 'Latest saved scan' in js and 'blend_no_weather' in js
    finally:
        asyncio.run(state.client.aclose())
        state.reset()
