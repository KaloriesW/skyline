from scan_assistant import measured_report

def test_review_brief_preserves_missing_values_and_searches_all_roads():
    rows=[]
    for i in range(1,32):
        rows.append({'properties':{'id':i,'latitude':24.,'longitude':121.,'area_m2':10000-i,
            'confidence':.2,'vegetation_check':'unavailable','slope_check':'supports','ndvi_drop':None,
            'slope_median_deg':40,'road_proximity_status':'available' if i==31 else 'unavailable',
            'road_distance_m':12 if i==31 else None,'nearest_road_name':'山路'}})
    result={'id':'a'*32,'acquired':'2026-11-05','center':[24,121],'width_km':6,'model':'U-Net',
            'count':31,'usable_percent':80,'geojson':{'features':rows}}
    r=measured_report(result);b=r['review_brief']
    assert b['near_road_200m_count']==1
    assert b['nearest_road_candidates'][0]['id']==31
    assert b['unavailable_counts']['vegetation_check']==31
    assert 'vegetation change unavailable' in r['overview']
    assert 'NDVI drop 0' not in r['overview']
    assert '24.000000, 121.000000' in r['overview']
    assert 'Next:' in r['overview']
    assert r['both_checks_count']==0

def test_area_explanation_uses_measurements_without_claiming_model_causality():
    from scan_assistant import grounded_scan_answer
    row={'id':105,'area_ha':12.45,'latitude':24.37714,'longitude':121.235412,
         'ndvi_drop':.08,'vegetation_check':'supports','slope_degrees':40.8,
         'slope_check':'supports','support_count':2,'road_distance_m':None}
    context={'report':{'review_brief':{'review_first':[row]}},'candidates':[row]}
    answer=grounded_scan_answer('Explain why Area 105 is worth reviewing',context)
    assert '0.080' in answer and '40.8°' in answer and '24.377140' in answer
    assert 'do not explain' in answer and 'No verified road distance' in answer
    assert grounded_scan_answer('How does U-Net work?',context) is None
