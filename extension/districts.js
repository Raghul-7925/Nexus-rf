/**
 * districts.js - Indian States & Districts Bounding Boxes Database
 * Provides accurate geographic bounds and centers for district-wise automated tower fetching.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TarangDistricts = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DISTRICTS_DATA = {
    "Tamil Nadu": {
      "Chennai": { bounds: [12.9100, 80.1200, 13.2300, 80.3300], center: [13.0827, 80.2707] },
      "Villupuram": { bounds: [11.8000, 79.2000, 12.3500, 80.0500], center: [11.9401, 79.4861] },
      "Coimbatore": { bounds: [10.5500, 76.6500, 11.4500, 77.3000], center: [11.0168, 76.9558] },
      "Madurai": { bounds: [9.6000, 77.8000, 10.2000, 78.4500], center: [9.9252, 78.1198] },
      "Salem": { bounds: [11.3500, 77.7000, 12.0500, 78.7500], center: [11.6643, 78.1460] },
      "Tiruchirappalli": { bounds: [10.3500, 78.3000, 11.1500, 79.0500], center: [10.7905, 78.7047] },
      "Tirunelveli": { bounds: [8.3000, 77.2000, 9.1000, 77.9000], center: [8.7139, 77.7567] },
      "Erode": { bounds: [11.1000, 76.8500, 11.9500, 77.9500], center: [11.3410, 77.7172] },
      "Vellore": { bounds: [12.6500, 78.8000, 13.0500, 79.4000], center: [12.9165, 79.1325] },
      "Ranipet": { bounds: [12.7500, 79.2000, 13.1500, 79.8000], center: [12.9224, 79.3328] },
      "Tirupathur": { bounds: [12.2500, 78.4000, 12.7500, 78.9500], center: [12.4925, 78.5678] },
      "Kanchipuram": { bounds: [12.6000, 79.5000, 13.0500, 80.0500], center: [12.8342, 79.7036] },
      "Chengalpattu": { bounds: [12.4500, 79.8000, 12.9500, 80.3000], center: [12.6819, 79.9888] },
      "Tiruvallur": { bounds: [13.0500, 79.6000, 13.5500, 80.3500], center: [13.1437, 79.9083] },
      "Cuddalore": { bounds: [11.2000, 79.2000, 11.8500, 79.8500], center: [11.7480, 79.7714] },
      "Kallakurichi": { bounds: [11.5000, 78.6000, 12.1500, 79.3500], center: [11.7383, 78.9639] },
      "Thanjavur": { bounds: [10.1500, 78.8000, 11.1500, 79.4500], center: [10.7870, 79.1378] },
      "Dindigul": { bounds: [10.0500, 77.3000, 10.7500, 78.2500], center: [10.3673, 77.9803] },
      "Tiruppur": { bounds: [10.5000, 77.1000, 11.3500, 77.7500], center: [11.1085, 77.3411] },
      "Dharmapuri": { bounds: [11.7500, 77.7000, 12.4500, 78.6000], center: [12.1211, 78.1582] },
      "Krishnagiri": { bounds: [12.1500, 77.4500, 12.8500, 78.5500], center: [12.5186, 78.2137] },
      "Namakkal": { bounds: [11.0000, 77.6500, 11.6000, 78.4500], center: [11.2189, 78.1674] },
      "Karur": { bounds: [10.6000, 77.7500, 11.1000, 78.3500], center: [10.9601, 78.0766] },
      "Perambalur": { bounds: [11.1000, 78.6500, 11.4500, 79.2000], center: [11.2342, 78.8820] },
      "Ariyalur": { bounds: [10.9000, 79.0000, 11.4500, 79.5500], center: [11.1401, 79.0786] },
      "Nagapattinam": { bounds: [10.2500, 79.6000, 10.9500, 79.9500], center: [10.7672, 79.8449] },
      "Mayiladuthurai": { bounds: [11.0000, 79.5000, 11.4000, 79.9000], center: [11.1075, 79.6524] },
      "Tiruvarur": { bounds: [10.3000, 79.3500, 11.0000, 79.8500], center: [10.7725, 79.6366] },
      "Pudukkottai": { bounds: [9.8500, 78.5000, 10.6000, 79.3000], center: [10.3797, 78.8208] },
      "Sivaganga": { bounds: [9.7000, 78.2000, 10.3000, 79.0500], center: [9.8433, 78.4809] },
      "Ramanathapuram": { bounds: [9.1000, 78.3000, 9.9000, 79.4000], center: [9.3639, 78.8395] },
      "Virudhunagar": { bounds: [9.2000, 77.3500, 9.7500, 78.3500], center: [9.5872, 77.9514] },
      "Theni": { bounds: [9.6000, 77.1500, 10.2500, 77.7500], center: [10.0104, 77.4768] },
      "Thoothukudi": { bounds: [8.3000, 77.8000, 9.2500, 78.3500], center: [8.7642, 78.1348] },
      "Tenkasi": { bounds: [8.8000, 77.1000, 9.4000, 77.7000], center: [8.9594, 77.3150] },
      "Kanniyakumari": { bounds: [8.0500, 77.1000, 8.5500, 77.6000], center: [8.0883, 77.5385] },
      "Nilgiris": { bounds: [11.1500, 76.3500, 11.7500, 77.0500], center: [11.4102, 76.6950] }
    },
    "Puducherry": {
      "Pondicherry": { bounds: [11.8200, 79.7000, 12.0500, 79.9000], center: [11.9416, 79.8083] },
      "Karaikal": { bounds: [10.8500, 79.7500, 11.0200, 79.8800], center: [10.9254, 79.8380] },
      "Mahe": { bounds: [11.6800, 75.5200, 11.7200, 75.5600], center: [11.7004, 75.5343] },
      "Yanam": { bounds: [16.7100, 82.1900, 16.7500, 82.2300], center: [16.7320, 82.2144] }
    },
    "Karnataka": {
      "Bengaluru Urban": { bounds: [12.7500, 77.4000, 13.2000, 77.8000], center: [12.9716, 77.5946] },
      "Bengaluru Rural": { bounds: [12.9500, 77.1500, 13.4500, 77.8500], center: [13.2847, 77.5540] },
      "Mysuru": { bounds: [11.7500, 76.0500, 12.6000, 77.1000], center: [12.2958, 76.6394] },
      "Mangaluru (Dakshina Kannada)": { bounds: [12.5000, 74.8000, 13.1500, 75.6000], center: [12.9141, 74.8560] },
      "Hubballi-Dharwad": { bounds: [15.1000, 74.8500, 15.6500, 75.4500], center: [15.3647, 75.1240] },
      "Belagavi": { bounds: [15.3500, 74.1000, 16.8500, 75.2500], center: [15.8497, 74.4977] },
      "Tumakuru": { bounds: [12.7500, 76.5000, 14.3500, 77.5500], center: [13.3392, 77.1017] },
      "Udupi": { bounds: [13.0000, 74.6500, 13.9500, 75.1500], center: [13.3409, 74.7421] },
      "Ballari": { bounds: [14.7000, 76.4500, 15.8000, 77.2500], center: [15.1394, 76.9214] },
      "Davanagere": { bounds: [13.9000, 75.6500, 14.7500, 76.4000], center: [14.4644, 75.9218] },
      "Shivamogga (Shimoga)": { bounds: [13.4500, 74.8500, 14.5000, 76.1500], center: [13.9299, 75.5681] }
    },
    "Maharashtra": {
      "Mumbai City": { bounds: [18.8900, 72.8000, 19.0500, 72.9000], center: [18.9388, 72.8354] },
      "Mumbai Suburban": { bounds: [19.0000, 72.7500, 19.3200, 72.9900], center: [19.1136, 72.8697] },
      "Pune": { bounds: [18.1500, 73.3500, 19.2500, 75.1500], center: [18.5204, 73.8567] },
      "Thane": { bounds: [19.1000, 72.9000, 19.7500, 73.5500], center: [19.2183, 72.9781] },
      "Nagpur": { bounds: [20.5500, 78.5500, 21.7500, 79.6000], center: [21.1458, 79.0882] },
      "Nashik": { bounds: [19.5000, 73.2500, 20.9000, 74.9500], center: [19.9975, 73.7898] },
      "Chhatrapati Sambhajinagar": { bounds: [19.3000, 74.8500, 20.6500, 76.1000], center: [19.8762, 75.3433] },
      "Solapur": { bounds: [17.1000, 74.9000, 18.3000, 76.3500], center: [17.6599, 75.9064] }
    },
    "Delhi NCR": {
      "New Delhi": { bounds: [28.5300, 77.1500, 28.6700, 77.2800], center: [28.6139, 77.2090] },
      "South Delhi": { bounds: [28.4500, 77.1200, 28.5800, 77.2700], center: [28.5244, 77.2066] },
      "North Delhi": { bounds: [28.6800, 77.1000, 28.8500, 77.2500], center: [28.7383, 77.1685] },
      "West Delhi": { bounds: [28.5900, 77.0200, 28.7000, 77.1500], center: [28.6500, 77.0800] },
      "East Delhi": { bounds: [28.6000, 77.2500, 28.6800, 77.3400], center: [28.6400, 77.3000] },
      "Gautam Buddha Nagar (Noida)": { bounds: [28.1500, 77.3000, 28.6500, 77.6500], center: [28.5355, 77.3910] },
      "Gurugram": { bounds: [28.2500, 76.7500, 28.5500, 77.1500], center: [28.4595, 77.0266] },
      "Ghaziabad": { bounds: [28.6000, 77.3500, 28.8500, 77.7500], center: [28.6692, 77.4538] },
      "Faridabad": { bounds: [28.2000, 77.2000, 28.5000, 77.5000], center: [28.4089, 77.3178] }
    },
    "Kerala": {
      "Thiruvananthapuram": { bounds: [8.2500, 76.7500, 8.8500, 77.3000], center: [8.5241, 76.9366] },
      "Ernakulam (Kochi)": { bounds: [9.7500, 76.1500, 10.3500, 76.8500], center: [9.9816, 76.2999] },
      "Kozhikode": { bounds: [11.1000, 75.6500, 11.7500, 76.1000], center: [11.2588, 75.7804] },
      "Thrissur": { bounds: [10.2000, 75.9500, 10.8000, 76.5500], center: [10.5276, 76.2144] },
      "Kollam": { bounds: [8.7500, 76.4500, 9.2000, 77.2500], center: [8.8932, 76.6141] },
      "Palakkad": { bounds: [10.3500, 76.2000, 11.2500, 76.9500], center: [10.7867, 76.6548] }
    },
    "Telangana": {
      "Hyderabad": { bounds: [17.2500, 78.3000, 17.5500, 78.6000], center: [17.3850, 78.4867] },
      "Rangareddy": { bounds: [16.8500, 77.8500, 17.6500, 78.8500], center: [17.3297, 78.5822] },
      "Medchal-Malkajgiri": { bounds: [17.4500, 78.4000, 17.7500, 78.7500], center: [17.5800, 78.5500] },
      "Warangal": { bounds: [17.8500, 79.4500, 18.2000, 79.8000], center: [17.9689, 79.5941] }
    },
    "Andhra Pradesh": {
      "Visakhapatnam": { bounds: [17.5500, 83.1000, 18.0500, 83.5500], center: [17.6868, 83.2185] },
      "Vijayawada (NTR)": { bounds: [16.4000, 80.4500, 16.7000, 80.8000], center: [16.5062, 80.6480] },
      "Guntur": { bounds: [15.8000, 79.8000, 16.6000, 80.7000], center: [16.3067, 80.4365] },
      "Tirupati": { bounds: [13.4000, 79.1500, 13.9500, 80.1000], center: [13.6288, 79.4192] }
    },
    "Gujarat": {
      "Ahmedabad": { bounds: [22.8500, 72.4000, 23.2000, 72.7500], center: [23.0225, 72.5714] },
      "Surat": { bounds: [21.0500, 72.7000, 21.3000, 73.0000], center: [21.1702, 72.8311] },
      "Vadodara": { bounds: [22.1500, 73.0500, 22.4500, 73.3500], center: [22.3072, 73.1812] },
      "Rajkot": { bounds: [22.1500, 70.6500, 22.4500, 70.9500], center: [22.3039, 70.8022] }
    },
    "Rajasthan": {
      "Jaipur": { bounds: [26.7000, 75.6000, 27.1000, 76.0500], center: [26.9124, 75.7873] },
      "Jodhpur": { bounds: [26.1500, 72.8500, 26.4500, 73.2000], center: [26.2389, 73.0243] },
      "Udaipur": { bounds: [24.4500, 73.5500, 24.7500, 73.8500], center: [24.5854, 73.7125] }
    },
    "Uttar Pradesh": {
      "Lucknow": { bounds: [26.6500, 80.7500, 27.0500, 81.1500], center: [26.8467, 80.9462] },
      "Kanpur": { bounds: [26.3500, 80.1500, 26.6000, 80.4500], center: [26.4499, 80.3319] },
      "Varanasi": { bounds: [25.2000, 82.8500, 25.4500, 83.1500], center: [25.3176, 82.9739] },
      "Prayagraj (Allahabad)": { bounds: [25.3000, 81.7000, 25.6000, 82.0000], center: [25.4358, 81.8463] },
      "Agra": { bounds: [27.0500, 77.8500, 27.3000, 78.1500], center: [27.1767, 78.0081] }
    },
    "West Bengal": {
      "Kolkata": { bounds: [22.4500, 88.2500, 22.6500, 88.4500], center: [22.5726, 88.3639] },
      "Howrah": { bounds: [22.5000, 88.1500, 22.7000, 88.3500], center: [22.5958, 88.2636] },
      "North 24 Parganas": { bounds: [22.5500, 88.3500, 23.2500, 89.1000], center: [22.7200, 88.4800] }
    },
    "Madhya Pradesh": {
      "Bhopal": { bounds: [23.1000, 77.2500, 23.4000, 77.5500], center: [23.2599, 77.4126] },
      "Indore": { bounds: [22.6000, 75.7500, 22.8500, 76.0000], center: [22.7196, 75.8577] }
    },
    "Bihar": {
      "Patna": { bounds: [25.5000, 85.0000, 25.7000, 85.3000], center: [25.5941, 85.1376] },
      "Gaya": { bounds: [24.6500, 84.8500, 24.9000, 85.1000], center: [24.7955, 85.0002] }
    },
    "Punjab & Haryana": {
      "Chandigarh": { bounds: [30.6500, 76.6800, 30.8200, 76.8500], center: [30.7333, 76.7794] },
      "Ludhiana": { bounds: [30.8000, 75.7500, 31.0000, 76.0000], center: [30.9010, 75.8573] },
      "Amritsar": { bounds: [31.5500, 74.7500, 31.7500, 75.0000], center: [31.6340, 74.8723] }
    }
  };

  /**
   * Get all available States
   */
  function getStates() {
    return Object.keys(DISTRICTS_DATA);
  }

  /**
   * Get Districts in a State
   */
  function getDistrictsForState(state) {
    if (!DISTRICTS_DATA[state]) return [];
    return Object.keys(DISTRICTS_DATA[state]);
  }

  /**
   * Get Bounds for a given state & district: [swLat, swLng, neLat, neLng]
   */
  function getDistrictBounds(state, district) {
    if (DISTRICTS_DATA[state] && DISTRICTS_DATA[state][district]) {
      return DISTRICTS_DATA[state][district].bounds;
    }
    // Fallback: search district name across all states
    return findDistrictByName(district)?.bounds || null;
  }

  /**
   * Find District by Name (case-insensitive fuzzy match)
   */
  function findDistrictByName(query) {
    if (!query || typeof query !== 'string') return null;
    const clean = query.trim().toLowerCase();

    for (const [state, districts] of Object.entries(DISTRICTS_DATA)) {
      for (const [dName, data] of Object.entries(districts)) {
        if (dName.toLowerCase() === clean || dName.toLowerCase().includes(clean)) {
          return {
            state,
            district: dName,
            bounds: data.bounds,
            center: data.center
          };
        }
      }
    }
    return null;
  }

  /**
   * Generate an optimized grid of slides for the district.
   * Step: ~0.022° lat (~2.4 km) × ~0.026° lng (~2.8 km), optimal for Tarang Sanchar bounding-box queries.
   */
  function generateDistrictSlides(bounds, stepLat = 0.022, stepLng = 0.026) {
    const [minLat, minLng, maxLat, maxLng] = bounds;
    const tiles = [];
    let rowIdx = 0;

    for (let lat = minLat; lat < maxLat; lat += stepLat) {
      let colIdx = 0;
      const rowTiles = [];
      for (let lng = minLng; lng < maxLng; lng += stepLng) {
        const swLat = Number(lat.toFixed(5));
        const neLat = Number(Math.min(maxLat, lat + stepLat).toFixed(5));
        const swLng = Number(lng.toFixed(5));
        const neLng = Number(Math.min(maxLng, lng + stepLng).toFixed(5));

        rowTiles.push({
          id: `dist_slide_${rowIdx}_${colIdx}`,
          row: rowIdx,
          col: colIdx,
          swLat,
          neLat,
          swLng,
          neLng,
          done: false
        });
        colIdx++;
      }

      // Alternate rows (snake sweep) to minimize map jump distance
      if (rowIdx % 2 === 1) {
        rowTiles.reverse();
      }
      tiles.push(...rowTiles);
      rowIdx++;
    }

    return tiles;
  }

  return {
    DISTRICTS_DATA,
    getStates,
    getDistrictsForState,
    getDistrictBounds,
    findDistrictByName,
    generateDistrictSlides
  };
});
