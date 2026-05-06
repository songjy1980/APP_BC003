from fastapi import APIRouter, UploadFile, File, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.database import get_db
from app.services.data_service import DataService

router = APIRouter(prefix="/api/v1/data", tags=["data"])
data_service = DataService()


@router.post("/upload")
async def upload_data(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(400, "仅支持 CSV/Excel 文件")
    contents = await file.read()
    result = await data_service.upload_csv(db, contents, file.filename)
    return result


@router.get("/records")
async def get_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    cost_group: Optional[str] = None,
    platform: Optional[str] = None,
    component: Optional[str] = None,
    site_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    return await data_service.get_records(
        db, page=page, page_size=page_size,
        cost_group=cost_group, platform=platform, component=component, site_name=site_name
    )


@router.get("/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    return await data_service.get_summary(db)


@router.get("/mappings")
async def get_mappings(db: AsyncSession = Depends(get_db)):
    return await data_service.get_mappings(db)


@router.put("/mappings")
async def update_mappings(mappings: list[dict], db: AsyncSession = Depends(get_db)):
    return await data_service.update_mappings(db, mappings)


@router.get("/historical-stats")
async def get_historical_stats(
    platform: Optional[str] = None,
    component: Optional[str] = None,
    country: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    return await data_service.get_historical_stats(db, platform=platform, component=component, country=country)
