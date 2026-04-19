"""Seed database with 4 initial steel industry articles."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db, SessionLocal
from models import Article
from services.graph_service import rebuild_graph

SEED_ARTICLES = [
    {
        "title": "Decarbonizing the Integrated Steel Mill With Efficient Hydrogen Integration",
        "topic_category": "Energy, Control & Digitalization",
        "publication_date": "2026-04",
        "summary_en": (
            "This article examines pathways for decarbonizing integrated steel mills through strategic "
            "hydrogen integration. The study evaluates direct reduced iron (DRI) processes powered by green "
            "hydrogen as a replacement for coke-based blast furnaces. Key findings show that hydrogen-DRI "
            "routes can reduce CO₂ emissions by up to 95% compared to conventional BF-BOF steelmaking, "
            "though capital costs and hydrogen supply chain development remain major challenges.\n\n"
            "The paper presents a techno-economic analysis of retrofitting an existing integrated mill in "
            "Southeast Asia, with findings relevant to SYS operations in Thailand. Transition timelines, "
            "grid renewable energy requirements, and government policy support are all discussed as critical "
            "enablers for successful decarbonization."
        ),
        "summary_th": (
            "บทความนี้ศึกษาแนวทางการลดการปล่อยคาร์บอนในโรงงานเหล็กแบบบูรณาการผ่านการใช้ไฮโดรเจนอย่างมีประสิทธิภาพ "
            "งานวิจัยประเมินกระบวนการเหล็กรีดิวซ์โดยตรง (DRI) ที่ขับเคลื่อนด้วยไฮโดรเจนสีเขียว เพื่อทดแทนเตาถลุงแบบโค้ก "
            "ผลการศึกษาชี้ให้เห็นว่าเส้นทาง Hydrogen-DRI สามารถลดการปล่อยก๊าซ CO₂ ได้สูงถึง 95% "
            "เมื่อเทียบกับการผลิตเหล็กแบบ BF-BOF ทั่วไป\n\n"
            "บทความนำเสนอการวิเคราะห์เชิงเทคนิคและเศรษฐศาสตร์สำหรับการปรับปรุงโรงงานเหล็กในเอเชียตะวันออกเฉียงใต้ "
            "ซึ่งมีความเกี่ยวข้องโดยตรงกับการดำเนินงานของ SYS ในประเทศไทย"
        ),
        "key_insights": [
            "Hydrogen-DRI routes can reduce CO₂ emissions by up to 95% vs. conventional BF-BOF steelmaking",
            "Green hydrogen costs must fall below $2/kg for economic viability without subsidies",
            "Retrofitting existing integrated mills is feasible but requires phased capital investment",
            "Renewable electricity grid capacity is the critical infrastructure bottleneck",
            "Government carbon pricing policy is the primary policy lever for accelerating transition",
            "Southeast Asian steel producers face unique grid and supply chain challenges vs. European peers",
            "Hybrid hydrogen + natural gas DRI routes offer a practical near-term transition path",
        ],
        "tags": [
            "hydrogen", "decarbonization", "DRI", "green steel", "CO2 reduction",
            "blast furnace", "energy transition", "climate", "net zero", "EAF",
            "steelmaking", "renewable energy", "carbon capture"
        ],
        "pdf_path": "/uploads/PR-PM0426-3_Decarbonizing_Integrated_Steel_Mill.pdf",
        "source_url": "https://imis.aist.org/Store/detail.aspx?id=PR-PM0426-3",
    },
    {
        "title": "Design and Implementation of High-Performance Submerged-Entry Nozzle Designs for Thin-Slab Casters",
        "topic_category": "Steel Making",
        "publication_date": "2026-02",
        "summary_en": (
            "This technical paper details advanced submerged-entry nozzle (SEN) designs for thin-slab "
            "continuous casting operations. The research presents computational fluid dynamics (CFD) "
            "simulations and plant validation trials comparing multiple nozzle geometries for turbulence "
            "control, inclusion removal, and mold flow uniformity.\n\n"
            "Results demonstrate that a modified bifurcated SEN with optimized port angles reduced "
            "mold level fluctuations by 30% and surface defect rates by 18% in production trials. "
            "The paper provides design guidelines applicable to thin-slab casters in the 50–90mm "
            "thickness range, directly relevant to modern compact strip production (CSP) lines."
        ),
        "summary_th": (
            "บทความเทคนิคนี้อธิบายรายละเอียดการออกแบบหัวฉีดจุ่มใต้น้ำ (SEN) สมรรถนะสูงสำหรับการหล่อแบบต่อเนื่อง "
            "ของแผ่นบาง งานวิจัยนำเสนอการจำลอง CFD และผลการทดลองในโรงงานจริง เปรียบเทียบรูปทรงหัวฉีดหลายแบบ "
            "เพื่อควบคุมความปั่นป่วน การกำจัดสิ่งสกปรก และความสม่ำเสมอของการไหลในแม่พิมพ์\n\n"
            "ผลการทดลองแสดงให้เห็นว่า SEN แบบสองทางที่ปรับปรุงแล้วลดความผันผวนของระดับน้ำเหล็กในแม่พิมพ์ได้ 30% "
            "และลดอัตราข้อบกพร่องพื้นผิวได้ 18% ในการผลิตจริง"
        ),
        "key_insights": [
            "Modified bifurcated SEN reduced mold level fluctuations by 30% in production trials",
            "Surface defect rates dropped 18% with optimized port angle design",
            "CFD simulation accurately predicted flow patterns validated by plant data",
            "Port angle between 15–25° provides optimal balance of depth penetration and surface flow",
            "SEN bore diameter significantly affects meniscus velocity and slag entrapment risk",
            "Argon injection rate must be optimized jointly with nozzle geometry",
            "Design guidelines apply to thin-slab casters in 50–90mm thickness range",
        ],
        "tags": [
            "SEN", "continuous casting", "thin slab", "CFD", "mold flow",
            "submerged entry nozzle", "steel quality", "surface defects",
            "turbulence", "inclusion", "CSP", "caster"
        ],
        "pdf_path": "/uploads/PR-PM0226-5_High_Performance_Submerged_Entry_Nozzle.pdf",
        "source_url": "https://imis.aist.org/Store/detail.aspx?id=PR-PM0226-5",
    },
    {
        "title": "Differentiating Performance in Water Glycol Fluids",
        "topic_category": "Plant Services & Reliability",
        "publication_date": "2026-02",
        "summary_en": (
            "This article evaluates the performance characteristics of water glycol hydraulic fluids used "
            "in steel plant equipment. The study compares multiple commercially available formulations "
            "across key parameters including fire resistance, lubrication performance, seal compatibility, "
            "corrosion protection, and fluid life expectancy under steel mill operating conditions.\n\n"
            "The paper provides practical maintenance guidance for fluid management programs, including "
            "concentration monitoring, contamination control, and change-out intervals. Cost-benefit "
            "analysis is presented comparing water glycol fluids against alternative fire-resistant "
            "fluid types for different steel plant application zones."
        ),
        "summary_th": (
            "บทความนี้ประเมินคุณลักษณะประสิทธิภาพของน้ำมันไฮดรอลิกแบบน้ำ-กลีเซอรอลที่ใช้ในอุปกรณ์โรงงานเหล็ก "
            "การศึกษาเปรียบเทียบสูตรเชิงพาณิชย์หลายรายการในพารามิเตอร์สำคัญ ได้แก่ ความต้านทานไฟ "
            "ประสิทธิภาพการหล่อลื่น ความเข้ากันได้กับซีล การป้องกันการกัดกร่อน และอายุการใช้งาน\n\n"
            "บทความให้คำแนะนำการบำรุงรักษาเชิงปฏิบัติสำหรับโปรแกรมจัดการของเหลว รวมถึงการตรวจสอบความเข้มข้น "
            "การควบคุมการปนเปื้อน และช่วงเวลาเปลี่ยนถ่าย"
        ),
        "key_insights": [
            "Water glycol fluids offer superior fire resistance in high-temperature steel plant zones",
            "Concentration monitoring (typically 35–50% glycol) is critical for optimal performance",
            "Corrosion inhibitor depletion is the primary cause of premature fluid failure",
            "Seal compatibility must be verified — nitrile seals are generally incompatible with glycols",
            "Fluid life of 3–5 years is achievable with proper maintenance programs",
            "Microbial contamination is a key risk in warm operating environments",
            "Cost per liter is higher but total cost of ownership is competitive when fire safety is valued",
        ],
        "tags": [
            "hydraulic fluid", "water glycol", "fire resistance", "lubrication",
            "maintenance", "plant services", "reliability", "contamination",
            "corrosion", "seal compatibility", "fluid management"
        ],
        "pdf_path": "/uploads/PR-PM0226-2_Differentiating_Performance_Water_Glycol_Fluids.pdf",
        "source_url": "https://imis.aist.org/Store/detail.aspx?id=PR-PM0226-2",
    },
    {
        "title": "Process Line Debottlenecking and Process Improvement Through an Empirical Data-Driven Model",
        "topic_category": "Plant Services & Reliability",
        "publication_date": "2026-03",
        "summary_en": (
            "This paper presents a data-driven methodology for identifying and resolving production "
            "bottlenecks in steel processing lines. The approach combines statistical process control (SPC), "
            "machine learning regression models, and production data analysis to pinpoint constraint "
            "operations and simulate improvement scenarios.\n\n"
            "A case study from a galvanizing line demonstrates a 12% throughput increase achieved by "
            "optimizing furnace temperature profiles, strip tension settings, and cooling section parameters. "
            "The methodology is generalizable to pickling, cold rolling, annealing, and coating lines. "
            "The paper emphasizes that empirical data-driven approaches outperform first-principles models "
            "for complex multi-variable process optimization in real plant environments."
        ),
        "summary_th": (
            "บทความนี้นำเสนอวิธีการที่ขับเคลื่อนด้วยข้อมูลเพื่อระบุและแก้ไขคอขวดการผลิตในสายการแปรรูปเหล็ก "
            "แนวทางนี้ผสมผสานการควบคุมกระบวนการทางสถิติ (SPC) โมเดล Machine Learning และการวิเคราะห์ข้อมูลการผลิต "
            "เพื่อระบุการดำเนินการที่เป็นข้อจำกัดและจำลองสถานการณ์การปรับปรุง\n\n"
            "กรณีศึกษาจากสายการชุบสังกะสีแสดงให้เห็นว่าสามารถเพิ่มปริมาณงานได้ 12% โดยการปรับโปรไฟล์อุณหภูมิเตาเผา "
            "การตั้งค่าแรงตึงแผ่นเหล็ก และพารามิเตอร์ส่วนระบายความร้อน วิธีการนี้สามารถนำไปใช้กับสายการดอง "
            "การรีดเย็น การอบอ่อน และสายการเคลือบ"
        ),
        "key_insights": [
            "Data-driven bottleneck analysis outperforms first-principles models for complex multi-variable processes",
            "12% throughput increase achieved on galvanizing line through empirical optimization",
            "Furnace temperature profile optimization is typically the highest-value intervention",
            "SPC combined with ML regression provides actionable process improvement targets",
            "Methodology is transferable across pickling, cold rolling, annealing, and coating lines",
            "Real-time monitoring integration enables continuous debottlenecking rather than one-time projects",
            "Data quality and historian system integrity are prerequisites for reliable model outputs",
        ],
        "tags": [
            "debottlenecking", "process optimization", "data-driven", "machine learning",
            "galvanizing", "throughput", "SPC", "digital", "Industry 4.0",
            "production efficiency", "bottleneck", "cold rolling", "annealing"
        ],
        "pdf_path": "/uploads/PR-PM0326-2_Process_Line_Debottlenecking_Empirical_Model.pdf",
        "source_url": "https://imis.aist.org/Store/detail.aspx?id=PR-PM0326-2",
    },
]


def run_seed():
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(Article).count()
        if existing > 0:
            print(f"Database already has {existing} articles. Skipping seed.")
            return
        for data in SEED_ARTICLES:
            article = Article(**data)
            db.add(article)
        db.commit()
        print(f"Seeded {len(SEED_ARTICLES)} articles.")
        rebuild_graph(db)
        print("Knowledge graph built.")
        # Try to add to vector store
        try:
            from services.vector_service import add_to_vector_store
            articles = db.query(Article).all()
            for a in articles:
                add_to_vector_store(a)
            print("Vector store populated.")
        except Exception as e:
            print(f"Vector store skipped: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
