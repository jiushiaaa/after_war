// Explicit compatibility contract for old exports: no warning, repair payment,
// automatic authorization or retroactive elapsed time is created at migration.
function emptyIncidents(at){
  return {schema:1,introducedAt:at,rng:((at^0x6d2b79f5)>>>0)||1,rolls:0,nextRollAt:at+600,lastTickAt:null,nextId:1,activeId:null,autoRoads:false,records:[]};
}
module.exports={emptyIncidents};
