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

import com.redhat.iot.proxy.model.Facility;
import com.redhat.iot.proxy.model.Line;
import com.redhat.iot.proxy.model.Run;
import com.redhat.iot.proxy.service.DGService;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * A simple REST service which proxies requests to a local datagrid.
 */

@Path("/facilities")
@Singleton
public class FacilitiesEndpoint {

    @Inject
    DGService dgService;

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

        Facility f = dgService.getFacilities().get(facilityId);

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


}

