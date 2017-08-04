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

import com.redhat.iot.proxy.model.*;
import com.redhat.iot.proxy.service.DGService;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.*;
import java.util.*;

/**
 * A simple REST service which proxies requests to a local datagrid.
 */

@Path("/utils")
@Singleton
public class UtilsEndpoint {

    public static final long MS_IN_HOUR = 24 * 60 * 60 * 1000;
    public static final int MACHINES_PER_LINE = 5;
    public static final int LINES_PER_FACILITY = 4;

    @Inject
    DGService dgService;

    @GET
    @Path("/health")
    public String health() {
        return "ok";
    }

    @POST
    @Path("/resetAll")
    public void resetAll() {

        Map<String, Customer> customerCache = dgService.getCustomers();
        Map<String, Facility> facilitiesCache = dgService.getFacilities();
        Map<String, Line> linesCache = dgService.getProductionLines();
        Map<String, Machine> machinesCache = dgService.getMachines();
        Map<String, Run> runsCache = dgService.getRuns();


        facilitiesCache.clear();
        linesCache.clear();
        customerCache.clear();
        machinesCache.clear();
        runsCache.clear();

        for (String COMPANY : COMPANIES) {
            customerCache.put(COMPANY,
                    new Customer(COMPANY, "password"));
        }

        for (String facName : FACILITY_LOCATIONS) {

            Facility newFacility = new Facility(facName, facName, new LatLng(20, -80), Math.random());
            newFacility.setUtilization(Math.random());
            List<Line> lines = new ArrayList<>();

            for (int j = 0; j < LINES_PER_FACILITY; j++) {
                Line line = new Line(guid());

                line.setDesc("Line " + facName + " " + j);
                line.setStatus("ok");

                List<Machine> machines = new ArrayList<>();

                for (int k = 0; k < MACHINES_PER_LINE; k++) {
                    Machine m = new Machine(guid());
                    m.setName(rand(MACHINE_NAMES));
                    m.setStatus("ok");
                    machinesCache.put(m.getMid(), m);
                }

                line.setMachines(machines);

                Date now = new Date();

                Run r = new Run();
                r.setCustomer(customerCache.get(rand(COMPANIES)));
                r.setDesc(rand(RUN_DESCRIPTIONS));
                r.setLine(line);
                r.setStatus("ok");
                r.setStart(new Date(now.getTime() - ((int)(Math.floor((Math.random()  * 6.0) * (double)MS_IN_HOUR)))));
                r.setEnd(new Date(now.getTime() + ((int)(Math.floor((Math.random()  * 3.0) * (double)MS_IN_HOUR)))));
                runsCache.put(r.getRid(), r);

                linesCache.put(line.getLid(), line);



            }

            newFacility.setLines(lines);

            facilitiesCache.put(facName, newFacility);
        }


    }

    private String guid() {
        return java.util.UUID.randomUUID().toString();
    }

    private String rand(String[] strs) {
        return strs[(int) Math.floor(Math.random() * strs.length)];
    }

    @GET
    @Path("/summaries")
    @Produces({"application/json"})
    public List<Summary> getSummaries() {

        List<Summary> result = new ArrayList<>();

        Summary clientSummary = getClientSUmmary();
        Summary facilitySummary = getFacilitySummary();

        result.add(clientSummary);
        result.add(facilitySummary);

        Summary mgrs = new Summary();
        mgrs.setName("fake");
        mgrs.setTitle("Managers");
        mgrs.setCount(23);
        mgrs.setWarningCount(4);
        mgrs.setErrorCount(1);
        result.add(mgrs);
        return result;
    }

    private Summary getFacilitySummary() {
        Map<String, Facility> cache = dgService.getFacilities();

        Summary summary = new Summary();
        summary.setName("facilities");
        summary.setTitle("Facilities");
        summary.setCount(cache.keySet().size());

        long warningCount = cache.keySet().stream()
                .map(cache::get)
                .filter(v -> v.getUtilization() < .7 && v.getUtilization() > .5)
                .count();

        long errorCount = cache.keySet().stream()
                .map(cache::get)
                .filter(v -> v.getUtilization() < .5)
                .count();

        summary.setWarningCount(warningCount);
        summary.setErrorCount(errorCount);

        return summary;
    }

    private Summary getClientSUmmary() {
        Map<String, Customer> cache = dgService.getCustomers();

        Summary summary = new Summary();
        summary.setName("clients");
        summary.setTitle("Clients");
        summary.setCount(cache.keySet().size());
        return summary;

    }

    public static final String[] COMPANIES = new String[]{
            "Wonka Industries",
            "Acme Corp",
            "Stark Industries",
            "Ollivander's Wand Shop",
            "Gekko & Co",
            "Wayne Enterprises",
            "Cyberdyne Systems",
            "Cheers",
            "Genco Pura",
            "NY Enquirer",
            "Duff Beer",
            "Bubba Gump Shrimp Co",
            "Olivia Pope & Associates",
            "Sterling Cooper",
            "Soylent",
            "Hooli",
            "Good Burger"
    };

    public static final String[] FACILITY_LOCATIONS = new String[]{
            "Atlanta",
            "Singapore",
            "Frankfurt",
            "Raleigh"
    };

    public static final String[] MACHINE_NAMES = new String[]{
            "Caster",
            "Cooler",
            "Weighting",
            "Spin Test"
    };

    public static final String[] RUN_DESCRIPTIONS = new String[]{
            "5000x fidget spinners",
            "2500x Die-cast",
            "10000x Three-prong"
    };


}

