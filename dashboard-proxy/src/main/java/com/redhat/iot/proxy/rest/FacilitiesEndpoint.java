/*
 * ******************************************************************************
 * Copyright (c) 2017 Red Hat, Inc. and others
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Red Hat Inc. - initial API and implementation
 *
 * ******************************************************************************
 */
package com.redhat.iot.proxy.rest;

import com.redhat.iot.proxy.model.CalEntry;
import com.redhat.iot.proxy.model.Facility;
import com.redhat.iot.proxy.model.Line;
import com.redhat.iot.proxy.model.Run;
import com.redhat.iot.proxy.service.AlertsService;
import com.redhat.iot.proxy.service.DGService;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * A simple REST service which proxies requests to a local datagrid.
 */

@Path("/facilities")
@Singleton
public class FacilitiesEndpoint {

    @Inject
    DGService dgService;

    private static final Logger log = Logger.getLogger(FacilitiesEndpoint.class.getName());

    @GET
    @Path("/top/{count}")
    @Produces({"application/json"})
    public List<Facility> topFacilities(@PathParam("count") int count) {

        Map<String, Facility> cache = dgService.getFacilities();


        return cache.keySet().stream()
                .map(cache::get).sorted(Comparator.comparingDouble(Facility::getUtilization))
                .limit(count)
                .collect(Collectors.toList());

    }

    @GET
    @Path("/{fid}/runs")
    @Produces({"application/json"})
    public List<Run> getRuns(@PathParam("fid") String facilityId) {

        Map<String, Line> cache = dgService.getProductionLines();

        return cache.keySet().stream()
                .map(cache::get)
                .map(Line::getCurrentRun)
                .collect(Collectors.toList());

    }

    @GET
    @Path("/")
    @Produces({"application/json"})
    public List<Facility> getAll() {

        Map<String, Facility> cache = dgService.getFacilities();

        return cache.keySet().stream()
                .map(cache::get)
                .collect(Collectors.toList());

    }

    @GET
    @Path("/calendar/{fid}/{type}")
    @Produces({"application/json"})
    public List<CalEntry> cal(@PathParam("fid") String fid, @PathParam("type") String type, @QueryParam("start") String start, @QueryParam("end") String end) {


        LocalDateTime startObj = LocalDate.parse(start, DateTimeFormatter.ISO_DATE).atStartOfDay();
        LocalDateTime endObj = LocalDate.parse(end, DateTimeFormatter.ISO_DATE).atStartOfDay();

        Date startDate = new Date(startObj.toInstant(ZoneOffset.UTC).toEpochMilli() - 24 * 60 * 60 * 1000);
        Date endDate = new Date(endObj.toInstant(ZoneOffset.UTC).toEpochMilli() + 24 * 60 * 60 * 1000);

        Map<String, CalEntry> cache = dgService.getCalendar();

        return cache.keySet().stream()
                .map(cache::get).filter(calEntry -> calEntry.getFacility().getFid().equals(fid) &&
                        calEntry.getStart().after(startDate) && calEntry.getEnd().before(endDate) &&
                        ("all".equals(type) || calEntry.getType().equals(type)))
                .collect(Collectors.toList());
    }

    @POST
    @Path("/calendar")
    @Consumes({"application/json"})
    @Produces({"application/json"})
    public void addEntry(CalEntry entry) {
        Map<String, CalEntry> calendarCache = dgService.getCalendar();

        calendarCache.put(UUID.randomUUID().toString(), entry);

    }

    @POST
    @Path("/{fid}/resetStatus")
    @Produces({"application/json"})
    public void resetStatus(@PathParam("fid") String fid) {
        log.info("Resetting status of " + fid);
        Facility facility = dgService.getFacilities().get(fid);
        if (facility == null) {
            throw new IllegalArgumentException("facility " + fid + " not found");
        }

        facility.getLines().forEach(line -> {
            line.setStatus("ok");
            dgService.getProductionLines().put(fid + "/" + line.getLid(), line);
            line.getMachines().forEach(machine -> {
                machine.setStatus("ok");
                dgService.getMachines().put(fid + "/" + line.getLid() + "/" + machine.getMid(), machine);
            });
        });

        dgService.getFacilities().put(fid, facility);


    }

}

